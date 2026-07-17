import {
	contentReviewEvent,
	contentVersion,
	db,
	learningContent,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
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

type TransitionOptions = {
	actorId: string;
	fromStatus: ContentStatus;
	id: string;
	note?: string;
	toStatus: ContentStatus;
	updates?: Partial<typeof contentVersion.$inferInsert>;
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
		.select({
			archivedAt: contentVersion.archivedAt,
			body: contentVersion.body,
			contentId: contentVersion.contentId,
			createdAt: contentVersion.createdAt,
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
		})
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

export const contentWorkflowRouter = {
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
			transitionVersion({
				actorId: context.session.user.id,
				fromStatus: "published",
				id: input.contentVersionId,
				note: input.note,
				toStatus: "archived",
				updates: { archivedAt: new Date() },
			}),
		),
	editDraft: permissionProcedure("content:review")
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

				let savedVersion = updatedVersion;
				if (Object.keys(updates).length > 0) {
					const [persistedVersion] = await transaction
						.update(contentVersion)
						.set(updates)
						.where(eq(contentVersion.id, input.contentVersionId))
						.returning();
					savedVersion = persistedVersion ?? updatedVersion;
				}
				return savedVersion ?? updatedVersion;
			}),
		),
	list: permissionProcedure("content:review")
		.input(listInput)
		.handler(({ input }) => listVersions(input.status)),
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
