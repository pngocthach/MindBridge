import {
	assessmentItem,
	contentReviewEvent,
	contentSkill,
	contentVersion,
	courseContent,
	db,
	learningContent,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, max, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure, protectedProcedure } from "../index";

const statuses = [
	"draft",
	"in_review",
	"approved",
	"published",
	"archived",
] as const;
const statusSchema = z.enum(statuses);
type ContentStatus = (typeof statuses)[number];
const contentKindSchema = z.enum(["lesson", "quiz", "practice"]);

const contentIdInput = z.object({ contentId: z.string().uuid() });

const draftValues = z.object({
	body: z.record(z.string(), z.unknown()),
	metadata: z.record(z.string(), z.unknown()),
	title: z.string().trim().min(1).max(255),
});

const createDraftInput = draftValues.extend({
	courseId: z.string().uuid(),
	kind: contentKindSchema,
});

const createVersionDraftInput = z.object({
	contentId: z.string().uuid(),
	sourceVersionId: z.string().uuid().optional(),
});

const archiveContentInput = contentIdInput.extend({
	note: z.string().trim().max(1000).optional(),
});

const listInput = z.object({
	status: statusSchema.optional(),
});

const transitionInput = z.object({
	contentVersionId: z.string().uuid(),
	note: z.string().trim().max(1000).optional(),
});

const editDraftInput = z
	.object({
		body: z.record(z.string(), z.unknown()).optional(),
		contentVersionId: z.string().uuid(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		title: z.string().trim().min(1).max(255).optional(),
	})
	.refine(
		(input) =>
			input.body !== undefined ||
			input.metadata !== undefined ||
			input.title !== undefined,
		{ message: "Provide at least one draft field to update." },
	);

const versionFields = {
	archivedAt: contentVersion.archivedAt,
	body: contentVersion.body,
	contentId: contentVersion.contentId,
	createdAt: contentVersion.createdAt,
	createdBy: contentVersion.createdBy,
	id: contentVersion.id,
	kind: learningContent.kind,
	metadata: contentVersion.metadata,
	publishedAt: contentVersion.publishedAt,
	reviewedAt: contentVersion.reviewedAt,
	reviewedBy: contentVersion.reviewedBy,
	status: contentVersion.status,
	title: sql<string>`coalesce(${contentVersion.metadata}->>'_draftTitle', ${learningContent.title})`,
	updatedAt: contentVersion.updatedAt,
	versionNumber: contentVersion.versionNumber,
};

type TransitionOptions = {
	actorId: string;
	fromStatus: ContentStatus;
	id: string;
	note?: string;
	toStatus: ContentStatus;
	updates?: Partial<typeof contentVersion.$inferInsert>;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A version that carries quiz questions but no primary skill can never be
 * submitted: mastery.submitAttempt requires at least one non-supporting skill
 * to score against. Reject it at publish time so the teacher finds out while
 * they can still fix it, instead of the learner hitting a dead end.
 */
const assertPublishable = async (transaction: Transaction, id: string) => {
	const [item] = await transaction
		.select({ id: assessmentItem.id })
		.from(assessmentItem)
		.where(eq(assessmentItem.contentVersionId, id))
		.limit(1);
	if (!item) {
		return;
	}

	const [primarySkill] = await transaction
		.select({ skillId: contentSkill.skillId })
		.from(contentSkill)
		.where(
			and(
				eq(contentSkill.contentVersionId, id),
				ne(contentSkill.coverage, "supporting"),
			),
		)
		.limit(1);
	if (!primarySkill) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Học liệu có câu hỏi kiểm tra nên phải gắn ít nhất một kỹ năng chính trước khi xuất bản.",
		});
	}
};

const transitionVersion = async ({
	actorId,
	fromStatus,
	id,
	note,
	toStatus,
	updates = {},
}: TransitionOptions) =>
	db.transaction(async (transaction) => {
		if (toStatus === "published") {
			await assertPublishable(transaction, id);
		}

		const [updatedVersion] = await transaction
			.update(contentVersion)
			.set({ ...updates, status: toStatus })
			.where(
				and(eq(contentVersion.id, id), eq(contentVersion.status, fromStatus)),
			)
			.returning();

		if (!updatedVersion) {
			const [existingVersion] = await transaction
				.select({ status: contentVersion.status })
				.from(contentVersion)
				.where(eq(contentVersion.id, id))
				.limit(1);

			if (!existingVersion) {
				throw new ORPCError("NOT_FOUND", {
					message: "Content version not found.",
				});
			}

			throw new ORPCError("CONFLICT", {
				message: `Content must be ${fromStatus} before moving to ${toStatus}.`,
			});
		}

		await transaction.insert(contentReviewEvent).values({
			actorId,
			contentVersionId: id,
			fromStatus,
			note,
			toStatus,
		});
		const versionMetadata = updatedVersion.metadata as Record<string, unknown>;
		const draftTitle =
			typeof versionMetadata._draftTitle === "string"
				? versionMetadata._draftTitle
				: undefined;
		if (toStatus === "published" && draftTitle !== undefined) {
			await transaction
				.update(learningContent)
				.set({ title: draftTitle })
				.where(eq(learningContent.id, updatedVersion.contentId));
		}

		return updatedVersion;
	});

const listVersions = async (status?: ContentStatus) =>
	db
		.select(versionFields)
		.from(contentVersion)
		.innerJoin(
			learningContent,
			eq(learningContent.id, contentVersion.contentId),
		)
		.where(
			status
				? eq(contentVersion.status, status)
				: ne(contentVersion.status, "archived"),
		)
		.orderBy(desc(contentVersion.updatedAt));

const archiveVersion = async (
	actorId: string,
	contentVersionId: string,
	note?: string,
) =>
	db.transaction(async (transaction) => {
		const [existingVersion] = await transaction
			.select({ status: contentVersion.status })
			.from(contentVersion)
			.where(eq(contentVersion.id, contentVersionId))
			.limit(1);
		if (!existingVersion) {
			throw new ORPCError("NOT_FOUND", {
				message: "Content version not found.",
			});
		}
		if (existingVersion.status === "archived") {
			throw new ORPCError("CONFLICT", {
				message: "Content version is already archived.",
			});
		}

		const [archivedVersion] = await transaction
			.update(contentVersion)
			.set({ archivedAt: new Date(), status: "archived" })
			.where(
				and(
					eq(contentVersion.id, contentVersionId),
					eq(contentVersion.status, existingVersion.status),
				),
			)
			.returning();
		if (!archivedVersion) {
			throw new ORPCError("CONFLICT", {
				message: "Content version changed before it could be archived.",
			});
		}
		await transaction.insert(contentReviewEvent).values({
			actorId,
			contentVersionId,
			fromStatus: existingVersion.status,
			note,
			toStatus: "archived",
		});
		return archivedVersion;
	});

export const contentWorkflowRouter = {
	editGeneratedDraft: permissionProcedure("content:create")
		.input(
			z.object({
				body: z.record(z.string(), z.unknown()),
				contentVersionId: z.string().uuid(),
				title: z.string().trim().min(1).max(255).optional(),
			}),
		)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				const [version] = await transaction
					.select({
						contentId: contentVersion.contentId,
						metadata: contentVersion.metadata,
					})
					.from(contentVersion)
					.where(
						and(
							eq(contentVersion.id, input.contentVersionId),
							eq(contentVersion.createdBy, context.session.user.id),
							eq(contentVersion.status, "draft"),
						),
					)
					.limit(1);
				if (!version) {
					throw new ORPCError("NOT_FOUND", {
						message: "Không tìm thấy bản nháp bạn có thể sửa.",
					});
				}

				const existingMetadata = version.metadata as Record<string, unknown>;
				const metadata =
					input.title === undefined
						? existingMetadata
						: { ...existingMetadata, _draftTitle: input.title };
				const [updatedVersion] = await transaction
					.update(contentVersion)
					.set({ body: input.body, metadata })
					.where(
						and(
							eq(contentVersion.id, input.contentVersionId),
							eq(contentVersion.status, "draft"),
						),
					)
					.returning({ id: contentVersion.id });
				if (!updatedVersion) {
					throw new ORPCError("CONFLICT", {
						message: "Bản nháp đã đổi trạng thái trước khi lưu.",
					});
				}
				if (input.title !== undefined) {
					await transaction
						.update(learningContent)
						.set({ title: input.title })
						.where(eq(learningContent.id, version.contentId));
				}
				return updatedVersion;
			}),
		),
	addGeneratedToCourse: permissionProcedure("content:create")
		.input(z.object({ contentVersionId: z.string().uuid() }))
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				const [generated] = await transaction
					.select({
						contentId: contentVersion.contentId,
						courseId: learningContent.courseId,
						status: contentVersion.status,
					})
					.from(contentVersion)
					.innerJoin(
						learningContent,
						eq(learningContent.id, contentVersion.contentId),
					)
					.where(
						and(
							eq(contentVersion.id, input.contentVersionId),
							eq(contentVersion.createdBy, context.session.user.id),
						),
					)
					.limit(1);
				if (!generated) {
					throw new ORPCError("NOT_FOUND", {
						message: "Không tìm thấy bản nháp bạn đã tạo.",
					});
				}
				if (generated.status !== "draft") {
					throw new ORPCError("CONFLICT", {
						message: "Chỉ bản nháp mới có thể xuất bản và gắn vào khóa học.",
					});
				}
				await assertPublishable(transaction, input.contentVersionId);

				const reviewedAt = new Date();
				const [publishedVersion] = await transaction
					.update(contentVersion)
					.set({
						publishedAt: reviewedAt,
						reviewedAt,
						reviewedBy: context.session.user.id,
						status: "published",
					})
					.where(
						and(
							eq(contentVersion.id, input.contentVersionId),
							eq(contentVersion.status, "draft"),
						),
					)
					.returning({ id: contentVersion.id });
				if (!publishedVersion) {
					throw new ORPCError("CONFLICT", {
						message: "Bản nháp đã đổi trạng thái trước khi xuất bản.",
					});
				}
				await transaction.insert(contentReviewEvent).values({
					actorId: context.session.user.id,
					contentVersionId: publishedVersion.id,
					fromStatus: "draft",
					toStatus: "published",
				});

				const [existing] = await transaction
					.select({ contentId: courseContent.contentId })
					.from(courseContent)
					.where(
						and(
							eq(courseContent.courseId, generated.courseId),
							eq(courseContent.contentId, generated.contentId),
						),
					)
					.limit(1);
				if (!existing) {
					const [lastPosition] = await transaction
						.select({ value: max(courseContent.position) })
						.from(courseContent)
						.where(eq(courseContent.courseId, generated.courseId));
					await transaction.insert(courseContent).values({
						contentId: generated.contentId,
						courseId: generated.courseId,
						position: (lastPosition?.value ?? 0) + 1,
					});
				}
				return { contentVersionId: publishedVersion.id };
			}),
		),
	approve: permissionProcedure("content:review")
		.input(transitionInput)
		.handler(({ context, input }) => {
			const reviewedAt = new Date();
			return transitionVersion({
				actorId: context.session.user.id,
				fromStatus: "in_review",
				id: input.contentVersionId,
				note: input.note,
				toStatus: "approved",
				updates: {
					reviewedAt,
					reviewedBy: context.session.user.id,
				},
			});
		}),
	archive: permissionProcedure("content:archive")
		.input(transitionInput)
		.handler(({ context, input }) =>
			archiveVersion(
				context.session.user.id,
				input.contentVersionId,
				input.note,
			),
		),
	archiveContent: permissionProcedure("content:archive")
		.input(archiveContentInput)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				await transaction.execute(
					sql`select ${learningContent.id} from ${learningContent} where ${learningContent.id} = ${input.contentId} for update`,
				);
				const [existingContent] = await transaction
					.select({ id: learningContent.id })
					.from(learningContent)
					.where(eq(learningContent.id, input.contentId))
					.limit(1);
				if (!existingContent) {
					throw new ORPCError("NOT_FOUND", {
						message: "Learning content not found.",
					});
				}

				const activeVersions = await transaction
					.select({ id: contentVersion.id, status: contentVersion.status })
					.from(contentVersion)
					.where(
						and(
							eq(contentVersion.contentId, input.contentId),
							ne(contentVersion.status, "archived"),
						),
					);
				if (activeVersions.length === 0) {
					throw new ORPCError("CONFLICT", {
						message: "Learning content is already archived.",
					});
				}

				const archivedAt = new Date();
				for (const version of activeVersions) {
					const [archivedVersion] = await transaction
						.update(contentVersion)
						.set({ archivedAt, status: "archived" })
						.where(
							and(
								eq(contentVersion.id, version.id),
								eq(contentVersion.status, version.status),
							),
						)
						.returning({ id: contentVersion.id });
					if (!archivedVersion) {
						throw new ORPCError("CONFLICT", {
							message: "A content version changed before it could be archived.",
						});
					}
				}
				await transaction.insert(contentReviewEvent).values(
					activeVersions.map((version) => ({
						actorId: context.session.user.id,
						contentVersionId: version.id,
						fromStatus: version.status,
						note: input.note,
						toStatus: "archived" as const,
					})),
				);
				return { archivedVersionCount: activeVersions.length };
			}),
		),
	createDraft: permissionProcedure("content:create")
		.input(createDraftInput)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				const [createdContent] = await transaction
					.insert(learningContent)
					.values({
						courseId: input.courseId,
						createdBy: context.session.user.id,
						kind: input.kind,
						title: input.title,
					})
					.returning();
				if (!createdContent) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Learning content could not be created.",
					});
				}
				const [createdVersion] = await transaction
					.insert(contentVersion)
					.values({
						body: input.body,
						contentId: createdContent.id,
						createdBy: context.session.user.id,
						metadata: { ...input.metadata, _draftTitle: input.title },
						versionNumber: 1,
					})
					.returning();
				if (!createdVersion) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Initial content draft could not be created.",
					});
				}
				return { content: createdContent, version: createdVersion };
			}),
		),
	createVersionDraft: permissionProcedure("content:create")
		.input(createVersionDraftInput)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				await transaction.execute(
					sql`select ${learningContent.id} from ${learningContent} where ${learningContent.id} = ${input.contentId} for update`,
				);
				const [existingContent] = await transaction
					.select({ id: learningContent.id, title: learningContent.title })
					.from(learningContent)
					.where(eq(learningContent.id, input.contentId))
					.limit(1);
				if (!existingContent) {
					throw new ORPCError("NOT_FOUND", {
						message: "Learning content not found.",
					});
				}

				const [existingDraft] = await transaction
					.select({ id: contentVersion.id })
					.from(contentVersion)
					.where(
						and(
							eq(contentVersion.contentId, input.contentId),
							eq(contentVersion.status, "draft"),
						),
					)
					.limit(1);
				if (existingDraft) {
					throw new ORPCError("CONFLICT", {
						message: "This content already has an editable draft.",
					});
				}

				const versionCondition = input.sourceVersionId
					? and(
							eq(contentVersion.contentId, input.contentId),
							eq(contentVersion.id, input.sourceVersionId),
						)
					: eq(contentVersion.contentId, input.contentId);
				const [sourceVersion] = await transaction
					.select()
					.from(contentVersion)
					.where(versionCondition)
					.orderBy(desc(contentVersion.versionNumber))
					.limit(1);
				if (!sourceVersion) {
					throw new ORPCError("NOT_FOUND", {
						message: "Source content version not found.",
					});
				}
				const [latestVersion] = await transaction
					.select({ versionNumber: contentVersion.versionNumber })
					.from(contentVersion)
					.where(eq(contentVersion.contentId, input.contentId))
					.orderBy(desc(contentVersion.versionNumber))
					.limit(1);
				const sourceMetadata = sourceVersion.metadata as Record<
					string,
					unknown
				>;
				const [createdVersion] = await transaction
					.insert(contentVersion)
					.values({
						body: sourceVersion.body,
						contentId: input.contentId,
						createdBy: context.session.user.id,
						metadata: {
							...sourceMetadata,
							_draftTitle:
								typeof sourceMetadata._draftTitle === "string"
									? sourceMetadata._draftTitle
									: existingContent.title,
						},
						versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
					})
					.returning();
				if (!createdVersion) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Content draft could not be created.",
					});
				}
				return createdVersion;
			}),
		),
	editDraft: permissionProcedure("content:update")
		.input(editDraftInput)
		.handler(async ({ input }) =>
			db.transaction(async (transaction) => {
				const [updatedVersion] = await transaction
					.select()
					.from(contentVersion)
					.where(
						and(
							eq(contentVersion.id, input.contentVersionId),
							eq(contentVersion.status, "draft"),
						),
					)
					.limit(1);

				if (!updatedVersion) {
					throw new ORPCError("CONFLICT", {
						message: "Only draft content can be edited.",
					});
				}

				const updates: Partial<typeof contentVersion.$inferInsert> = {};
				if (input.body !== undefined) updates.body = input.body;
				if (input.metadata !== undefined) updates.metadata = input.metadata;
				if (input.title !== undefined) {
					const existingMetadata = updatedVersion.metadata as Record<
						string,
						unknown
					>;
					updates.metadata = {
						...(input.metadata ?? existingMetadata),
						_draftTitle: input.title,
					};
				}

				const [savedVersion] = await transaction
					.update(contentVersion)
					.set(updates)
					.where(
						and(
							eq(contentVersion.id, input.contentVersionId),
							eq(contentVersion.status, "draft"),
						),
					)
					.returning();
				if (!savedVersion) {
					throw new ORPCError("CONFLICT", {
						message: "Draft status changed before the edit could be saved.",
					});
				}
				return savedVersion;
			}),
		),
	list: permissionProcedure("content:review")
		.input(listInput)
		.handler(({ input }) => listVersions(input.status)),
	listContent: permissionProcedure("content:review").handler(async () => {
		const rows = await db
			.select({
				contentId: learningContent.id,
				courseId: learningContent.courseId,
				createdAt: learningContent.createdAt,
				kind: learningContent.kind,
				latestStatus: contentVersion.status,
				latestVersionNumber: contentVersion.versionNumber,
				title: learningContent.title,
				updatedAt: learningContent.updatedAt,
				versionId: contentVersion.id,
			})
			.from(learningContent)
			.leftJoin(
				contentVersion,
				eq(contentVersion.contentId, learningContent.id),
			)
			.orderBy(asc(learningContent.title), desc(contentVersion.versionNumber));
		const summaries = new Map<
			string,
			{
				archivedVersionCount: number;
				contentId: string;
				courseId: string;
				createdAt: Date;
				kind: "lesson" | "practice" | "quiz";
				latestStatus: ContentStatus | null;
				latestVersionNumber: number | null;
				title: string;
				updatedAt: Date;
				versionCount: number;
			}
		>();
		for (const row of rows) {
			const summary = summaries.get(row.contentId);
			if (summary) {
				if (row.versionId) summary.versionCount += 1;
				if (row.latestStatus === "archived") {
					summary.archivedVersionCount += 1;
				}
				continue;
			}
			summaries.set(row.contentId, {
				archivedVersionCount: row.latestStatus === "archived" ? 1 : 0,
				contentId: row.contentId,
				courseId: row.courseId,
				createdAt: row.createdAt,
				kind: row.kind,
				latestStatus: row.latestStatus,
				latestVersionNumber: row.latestVersionNumber,
				title: row.title,
				updatedAt: row.updatedAt,
				versionCount: row.versionId ? 1 : 0,
			});
		}
		return [...summaries.values()].map((summary) => ({
			...summary,
			isArchived:
				summary.versionCount > 0 &&
				summary.archivedVersionCount === summary.versionCount,
		}));
	}),
	listHistory: permissionProcedure("content:review")
		.input(contentIdInput)
		.handler(async ({ input }) => {
			const [content] = await db
				.select()
				.from(learningContent)
				.where(eq(learningContent.id, input.contentId))
				.limit(1);
			if (!content) {
				throw new ORPCError("NOT_FOUND", {
					message: "Learning content not found.",
				});
			}
			const versions = await db
				.select(versionFields)
				.from(contentVersion)
				.innerJoin(
					learningContent,
					eq(learningContent.id, contentVersion.contentId),
				)
				.where(eq(contentVersion.contentId, input.contentId))
				.orderBy(desc(contentVersion.versionNumber));
			return { content, versions };
		}),
	listPublished: protectedProcedure.handler(async () => {
		const versions = await listVersions("published");
		return versions.map(({ reviewedAt, reviewedBy, ...version }) => version);
	}),
	publish: permissionProcedure("content:publish")
		.input(transitionInput)
		.handler(({ context, input }) =>
			transitionVersion({
				actorId: context.session.user.id,
				fromStatus: "approved",
				id: input.contentVersionId,
				note: input.note,
				toStatus: "published",
				updates: { publishedAt: new Date() },
			}),
		),
	submitForReview: permissionProcedure("content:submit-review")
		.input(transitionInput)
		.handler(({ context, input }) =>
			transitionVersion({
				actorId: context.session.user.id,
				fromStatus: "draft",
				id: input.contentVersionId,
				note: input.note,
				toStatus: "in_review",
			}),
		),
};
