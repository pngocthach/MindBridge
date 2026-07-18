import {
	contentVersion,
	course,
	courseContent,
	db,
	learningContent,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, exists, isNull, max, notInArray } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

const courseInput = z.object({ courseId: z.string().uuid() });
const contentInput = courseInput.extend({ contentId: z.string().uuid() });

export const validateReorder = (
	currentContentIds: string[],
	orderedContentIds: string[],
): boolean =>
	currentContentIds.length === orderedContentIds.length &&
	new Set(orderedContentIds).size === orderedContentIds.length &&
	currentContentIds.every((contentId) => orderedContentIds.includes(contentId));

const requireActiveCourse = async (
	transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
	courseId: string,
) => {
	const [activeCourse] = await transaction
		.select({ id: course.id })
		.from(course)
		.where(and(eq(course.id, courseId), isNull(course.archivedAt)))
		.limit(1);
	if (!activeCourse) {
		throw new ORPCError("NOT_FOUND", { message: "Active course not found." });
	}
};

const publishedContentExists = () =>
	exists(
		db
			.select({ id: contentVersion.id })
			.from(contentVersion)
			.where(
				and(
					eq(contentVersion.contentId, learningContent.id),
					eq(contentVersion.status, "published"),
				),
			),
	);

export const courseCurriculumRouter = {
	add: adminProcedure.input(contentInput).handler(({ input }) =>
		db.transaction(async (transaction) => {
			await requireActiveCourse(transaction, input.courseId);
			const [publishedContent] = await transaction
				.select({ id: learningContent.id })
				.from(learningContent)
				.where(
					and(
						eq(learningContent.id, input.contentId),
						eq(learningContent.courseId, input.courseId),
						publishedContentExists(),
					),
				)
				.limit(1);
			if (!publishedContent) {
				throw new ORPCError("NOT_FOUND", {
					message: "Published course content not found.",
				});
			}

			const [lastPosition] = await transaction
				.select({ value: max(courseContent.position) })
				.from(courseContent)
				.where(eq(courseContent.courseId, input.courseId));
			const [createdItem] = await transaction
				.insert(courseContent)
				.values({
					contentId: input.contentId,
					courseId: input.courseId,
					position: (lastPosition?.value ?? 0) + 1,
				})
				.onConflictDoNothing()
				.returning();
			if (!createdItem) {
				throw new ORPCError("CONFLICT", {
					message: "Content is already in this curriculum.",
				});
			}
			return createdItem;
		}),
	),
	list: adminProcedure.input(courseInput).handler(({ input }) =>
		db
			.select({
				contentId: learningContent.id,
				isRequired: courseContent.isRequired,
				isPublished: publishedContentExists(),
				kind: learningContent.kind,
				position: courseContent.position,
				title: learningContent.title,
			})
			.from(courseContent)
			.innerJoin(
				learningContent,
				eq(learningContent.id, courseContent.contentId),
			)
			.where(eq(courseContent.courseId, input.courseId))
			.orderBy(asc(courseContent.position)),
	),
	listAvailable: adminProcedure.input(courseInput).handler(({ input }) =>
		db
			.select({
				contentId: learningContent.id,
				kind: learningContent.kind,
				title: learningContent.title,
			})
			.from(learningContent)
			.where(
				and(
					eq(learningContent.courseId, input.courseId),
					publishedContentExists(),
					notInArray(
						learningContent.id,
						db
							.select({ id: courseContent.contentId })
							.from(courseContent)
							.where(eq(courseContent.courseId, input.courseId)),
					),
				),
			)
			.orderBy(asc(learningContent.title)),
	),
	remove: adminProcedure.input(contentInput).handler(({ input }) =>
		db.transaction(async (transaction) => {
			await requireActiveCourse(transaction, input.courseId);
			const [removedItem] = await transaction
				.delete(courseContent)
				.where(
					and(
						eq(courseContent.courseId, input.courseId),
						eq(courseContent.contentId, input.contentId),
					),
				)
				.returning();
			if (!removedItem) {
				throw new ORPCError("NOT_FOUND", {
					message: "Curriculum item not found.",
				});
			}

			const remainingItems = await transaction
				.select({
					contentId: courseContent.contentId,
					position: courseContent.position,
				})
				.from(courseContent)
				.where(eq(courseContent.courseId, input.courseId))
				.orderBy(asc(courseContent.position));
			const temporaryPositionStart =
				Math.max(
					removedItem.position,
					...remainingItems.map((item) => item.position),
				) + 1;
			for (const [index, item] of remainingItems.entries()) {
				await transaction
					.update(courseContent)
					.set({ position: temporaryPositionStart + index })
					.where(
						and(
							eq(courseContent.courseId, input.courseId),
							eq(courseContent.contentId, item.contentId),
						),
					);
			}
			for (const [index, item] of remainingItems.entries()) {
				await transaction
					.update(courseContent)
					.set({ position: index + 1 })
					.where(
						and(
							eq(courseContent.courseId, input.courseId),
							eq(courseContent.contentId, item.contentId),
						),
					);
			}
			return removedItem;
		}),
	),
	reorder: adminProcedure
		.input(
			courseInput.extend({
				contentIds: z.array(z.string().uuid()).max(500),
			}),
		)
		.handler(({ input }) =>
			db.transaction(async (transaction) => {
				await requireActiveCourse(transaction, input.courseId);
				const currentItems = await transaction
					.select({
						contentId: courseContent.contentId,
						position: courseContent.position,
					})
					.from(courseContent)
					.where(eq(courseContent.courseId, input.courseId));
				if (
					!validateReorder(
						currentItems.map((item) => item.contentId),
						input.contentIds,
					)
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Reorder must include every curriculum item exactly once.",
					});
				}

				const temporaryPositionStart =
					Math.max(0, ...currentItems.map((item) => item.position)) + 1;
				for (const [index, contentId] of input.contentIds.entries()) {
					await transaction
						.update(courseContent)
						.set({ position: temporaryPositionStart + index })
						.where(
							and(
								eq(courseContent.courseId, input.courseId),
								eq(courseContent.contentId, contentId),
							),
						);
				}
				for (const [index, contentId] of input.contentIds.entries()) {
					await transaction
						.update(courseContent)
						.set({ position: index + 1 })
						.where(
							and(
								eq(courseContent.courseId, input.courseId),
								eq(courseContent.contentId, contentId),
							),
						);
				}
				return { contentIds: input.contentIds };
			}),
		),
};
