import type {
	ContentGenerationEvent,
	ContentGenerationPort,
	GenerateLessonDraftInput,
} from "@MindBridge/api";
import { db } from "@MindBridge/db";
import {
	contentGeneration,
	contentSkill,
	contentSourceReference,
	contentVersion,
	learningContent,
	sourceChunk,
	sourceDocument,
} from "@MindBridge/db/schema/content";
import { skill } from "@MindBridge/db/schema/learning";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { LessonDraft } from "../../../baml_client";
import { assertValidDraft, collectReferences } from "./draft-validation";

const MAX_SOURCE_CHARACTERS = 60_000;

export class SourceDocumentAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SourceDocumentAccessError";
	}
}

export interface OpenAiCompatibleConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
}

export type GenerateLessonDraftRequest = GenerateLessonDraftInput;

const getErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Không thể tạo bản nháp học liệu.";

const requireInserted = <T>(value: T | undefined, message: string): T => {
	if (!value) {
		throw new Error(message);
	}
	return value;
};

const withRequiredLessonFields = (
	draft: unknown,
	chunks: Array<{ id: string; text: string }>,
) => {
	const candidate = draft as Record<string, unknown>;
	const firstSourceText = chunks[0]?.text.trim() ?? "";
	const summary =
		typeof candidate.summary === "string" && candidate.summary.trim().length > 0
			? candidate.summary
			: firstSourceText.slice(0, 500) || "Tóm tắt được tạo từ tài liệu nguồn.";
	const title =
		typeof candidate.title === "string" && candidate.title.trim().length > 0
			? candidate.title
			: firstSourceText
					.split(/\r?\n/)
					.find((line) => line.trim())
					?.slice(0, 120) || "Học liệu từ tài liệu nguồn";

	return { ...candidate, summary, title };
};

const extractJson = (content: string): Record<string, unknown> => {
	const start = content.indexOf("{");
	const end = content.lastIndexOf("}");
	if (start < 0 || end <= start) {
		throw new Error("LLM không trả về JSON hợp lệ.");
	}
	const parsed: unknown = JSON.parse(content.slice(start, end + 1));
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("LLM không trả về object JSON hợp lệ.");
	}
	return parsed as Record<string, unknown>;
};

const requestLessonDraft = async (
	config: OpenAiCompatibleConfig,
	chunks: Array<{ id: string; text: string }>,
): Promise<Record<string, unknown>> => {
	const response = await fetch(
		`${config.baseUrl.replace(/\/$/, "")}/chat/completions`,
		{
			body: JSON.stringify({
				messages: [
					{
						role: "system",
						content:
							"Bạn là chuyên gia thiết kế học liệu. Chỉ sử dụng thông tin trong tài liệu nguồn và chỉ trả về một object JSON.",
					},
					{
						role: "user",
						content: `Tạo lesson draft tiếng Việt theo schema JSON sau. Bắt buộc có title và summary không rỗng, ít nhất 5 quiz_questions, một exercise EASY và một exercise STANDARD. Mọi source_chunk_ids phải là ID có trong nguồn.\n\nSchema: { title: string, summary: string, summary_source_chunk_ids: string[], objectives: { text: string, source_chunk_ids: string[] }[], quiz_questions: { question: string, options: string[], correct_answer: string, explanation: string, source_chunk_ids: string[] }[], exercises: { difficulty: "EASY" | "STANDARD", prompt: string, expected_answer: string, explanation: string, source_chunk_ids: string[] }[] }\n\nNguồn:\n${JSON.stringify(chunks)}`,
					},
				],
				model: config.model,
				temperature: 0.2,
			}),
			headers: {
				"content-type": "application/json",
				...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
			},
			method: "POST",
		},
	);
	if (!response.ok) {
		throw new Error(`Content LLM request failed with ${response.status}.`);
	}
	const payload = (await response.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	const content = payload.choices?.at(0)?.message?.content;
	if (!content) {
		throw new Error("Content LLM response was empty.");
	}
	return extractJson(content);
};

export class LessonGenerationService implements ContentGenerationPort {
	constructor(private readonly config?: OpenAiCompatibleConfig) {}

	async *generateLessonDraft(
		input: GenerateLessonDraftRequest,
	): AsyncGenerator<ContentGenerationEvent> {
		if (!this.config) {
			throw new SourceDocumentAccessError(
				"OpenAI-compatible API chưa được cấu hình.",
			);
		}
		const config = this.config;
		const document = await db.query.sourceDocument.findFirst({
			where: eq(sourceDocument.id, input.documentId),
		});
		if (!document) {
			throw new SourceDocumentAccessError("Không tìm thấy tài liệu nguồn.");
		}
		if (!input.canUseAnySource && document.uploadedBy !== input.requestedBy) {
			throw new SourceDocumentAccessError(
				"Bạn không có quyền dùng tài liệu này.",
			);
		}
		if (document.extractionStatus !== "completed") {
			throw new SourceDocumentAccessError(
				"Tài liệu chưa sẵn sàng để tạo học liệu.",
			);
		}

		const availableChunks = await db
			.select({ id: sourceChunk.id, text: sourceChunk.text })
			.from(sourceChunk)
			.where(
				and(
					eq(sourceChunk.documentId, input.documentId),
					input.chunkIds ? inArray(sourceChunk.id, input.chunkIds) : undefined,
				),
			)
			.orderBy(asc(sourceChunk.ordinal));
		if (availableChunks.length === 0) {
			throw new SourceDocumentAccessError(
				"Tài liệu không có nội dung đã trích xuất.",
			);
		}

		const chunks: Array<{ id: string; text: string }> = [];
		let sourceCharacterCount = 0;
		for (const chunk of availableChunks) {
			const remainingCharacters = MAX_SOURCE_CHARACTERS - sourceCharacterCount;
			if (remainingCharacters <= 0) {
				break;
			}
			chunks.push({
				...chunk,
				text: chunk.text.slice(0, remainingCharacters),
			});
			sourceCharacterCount += Math.min(chunk.text.length, remainingCharacters);
		}

		const [createdGeneration] = await db
			.insert(contentGeneration)
			.values({
				inputSnapshot: {
					documentId: input.documentId,
					sourceChunkIds: chunks.map(({ id }) => id),
				},
				model: config.model,
				promptVersion: "lesson-draft-v1",
				requestedBy: input.requestedBy,
			})
			.returning({ id: contentGeneration.id });
		const generation = requireInserted(
			createdGeneration,
			"Không thể lưu yêu cầu tạo học liệu.",
		);

		yield { generationId: generation.id, type: "started" };

		try {
			const draft = withRequiredLessonFields(
				await requestLessonDraft(config, chunks),
				chunks,
			) as unknown as LessonDraft;
			yield {
				draft: draft as unknown as Record<string, unknown>,
				type: "partial",
			};
			assertValidDraft(draft, new Set(chunks.map(({ id }) => id)));

			const { contentId, contentVersionId } = await db.transaction(
				async (tx) => {
					const [createdContent] = await tx
						.insert(learningContent)
						.values({
							courseId: input.courseId,
							createdBy: input.requestedBy,
							kind: "lesson",
							title: draft.title,
						})
						.returning({ id: learningContent.id });
					const content = requireInserted(
						createdContent,
						"Không thể lưu học liệu.",
					);
					const [createdVersion] = await tx
						.insert(contentVersion)
						.values({
							body: draft,
							contentId: content.id,
							createdBy: input.requestedBy,
							metadata: {
								...input.metadata,
								sourceDocumentId: input.documentId,
							},
							status: "draft",
							versionNumber: 1,
						})
						.returning({ id: contentVersion.id });
					const version = requireInserted(
						createdVersion,
						"Không thể lưu phiên bản học liệu.",
					);
					const requestedSkillIds = [...new Set(input.metadata.skillIds)];
					if (requestedSkillIds.length > 0) {
						const validSkills = await tx
							.select({ id: skill.id })
							.from(skill)
							.where(inArray(skill.id, requestedSkillIds));
						if (validSkills.length > 0) {
							await tx.insert(contentSkill).values(
								validSkills.map(({ id }, index) => ({
									contentVersionId: version.id,
									coverage:
										index === 0
											? ("primary" as const)
											: ("supporting" as const),
									skillId: id,
								})),
							);
						}
					}

					const uniqueReferences = new Map<
						string,
						{ referenceKind: string; sourceChunkId: string }
					>();
					for (const reference of collectReferences(draft)) {
						for (const sourceChunkId of reference.chunkIds) {
							uniqueReferences.set(
								`${reference.referenceKind}:${sourceChunkId}`,
								{
									referenceKind: reference.referenceKind,
									sourceChunkId,
								},
							);
						}
					}
					if (uniqueReferences.size > 0) {
						await tx.insert(contentSourceReference).values(
							[...uniqueReferences.values()].map((reference) => ({
								contentVersionId: version.id,
								referenceKind: reference.referenceKind,
								sourceChunkId: reference.sourceChunkId,
							})),
						);
					}

					return { contentId: content.id, contentVersionId: version.id };
				},
			);

			await db
				.update(contentGeneration)
				.set({
					completedAt: new Date(),
					contentVersionId,
					outputSnapshot: draft,
					status: "succeeded",
				})
				.where(eq(contentGeneration.id, generation.id));

			yield {
				contentId,
				contentVersionId,
				generationId: generation.id,
				type: "completed",
			};
		} catch (error) {
			const message = getErrorMessage(error);
			await db
				.update(contentGeneration)
				.set({
					completedAt: new Date(),
					error: message,
					status: "failed",
				})
				.where(eq(contentGeneration.id, generation.id));
			yield { generationId: generation.id, message, type: "failed" };
		}
	}
}

export { assertValidDraft };
