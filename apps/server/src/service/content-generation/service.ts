import type {
	ContentGenerationEvent,
	ContentGenerationPort,
	GenerateLessonDraftInput,
} from "@MindBridge/api";
import { db } from "@MindBridge/db";
import {
	contentGeneration,
	contentSourceReference,
	contentVersion,
	learningContent,
	sourceChunk,
	sourceDocument,
} from "@MindBridge/db/schema/content";
import { ClientRegistry } from "@boundaryml/baml";
import { and, asc, eq, inArray } from "drizzle-orm";

import { b } from "../../../baml_client";
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

		const chunks = await db
			.select({ id: sourceChunk.id, text: sourceChunk.text })
			.from(sourceChunk)
			.where(
				and(
					eq(sourceChunk.documentId, input.documentId),
					input.chunkIds ? inArray(sourceChunk.id, input.chunkIds) : undefined,
				),
			)
			.orderBy(asc(sourceChunk.ordinal));
		if (chunks.length === 0) {
			throw new SourceDocumentAccessError(
				"Tài liệu không có nội dung đã trích xuất.",
			);
		}

		const sourceCharacterCount = chunks.reduce(
			(total, chunk) => total + chunk.text.length,
			0,
		);
		if (sourceCharacterCount > MAX_SOURCE_CHARACTERS) {
			throw new SourceDocumentAccessError(
				"Tài liệu quá dài để tạo một bản nháp. Hãy chọn ít đoạn nguồn hơn.",
			);
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
			const clientRegistry = new ClientRegistry();
			clientRegistry.addLlmClient("MindBridgeModel", "openai-generic", {
				api_key: config.apiKey,
				base_url: config.baseUrl,
				model: config.model,
			});
			clientRegistry.setPrimary("MindBridgeModel");

			const stream = b.stream.GenerateLessonDraft(chunks, {
				clientRegistry,
				signal: input.signal,
			});
			for await (const partial of stream) {
				yield {
					draft: partial as unknown as Record<string, unknown>,
					type: "partial",
				};
			}

			const draft = await stream.getFinalResponse();
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
