import { course, db } from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, permissionProcedure } from "../index";

const courseFields = {
	archivedAt: course.archivedAt,
	createdAt: course.createdAt,
	description: course.description,
	gradeLevel: course.gradeLevel,
	id: course.id,
	language: course.language,
	title: course.title,
	updatedAt: course.updatedAt,
};

const courseDetailsInput = z.object({ courseId: z.string().uuid() });

const courseValues = z.object({
	description: z.string().trim().min(1).max(5000),
	gradeLevel: z.number().int().min(1).max(12),
	language: z.string().trim().min(2).max(10).default("vi"),
	title: z.string().trim().min(1).max(255),
});

const updateCourseInput = courseValues
	.partial()
	.extend({
		courseId: z.string().uuid(),
	})
	.refine(
		(input) =>
			input.description !== undefined ||
			input.gradeLevel !== undefined ||
			input.language !== undefined ||
			input.title !== undefined,
		{ message: "Provide at least one course field to update." },
	);

const getActiveCourse = async (courseId: string) => {
	const [activeCourse] = await db
		.select(courseFields)
		.from(course)
		.where(and(eq(course.id, courseId), isNull(course.archivedAt)))
		.limit(1);

	if (!activeCourse) {
		throw new ORPCError("NOT_FOUND", { message: "Active course not found." });
	}
	return activeCourse;
};

export const courseRouter = {
	archive: adminProcedure
		.input(courseDetailsInput)
		.handler(async ({ input }) => {
			const [archivedCourse] = await db
				.update(course)
				.set({ archivedAt: new Date() })
				.where(and(eq(course.id, input.courseId), isNull(course.archivedAt)))
				.returning(courseFields);
			if (!archivedCourse) {
				throw new ORPCError("NOT_FOUND", {
					message: "Active course not found.",
				});
			}
			return archivedCourse;
		}),
	create: adminProcedure.input(courseValues).handler(({ context, input }) =>
		db.transaction(async (transaction) => {
			const [createdCourse] = await transaction
				.insert(course)
				.values({ ...input, createdBy: context.session.user.id })
				.returning(courseFields);
			if (!createdCourse) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Course could not be created.",
				});
			}
			return createdCourse;
		}),
	),
	get: adminProcedure
		.input(courseDetailsInput)
		.handler(({ input }) => getActiveCourse(input.courseId)),
	list: adminProcedure
		.input(z.object({ includeArchived: z.boolean().default(false) }))
		.handler(({ input }) =>
			db
				.select(courseFields)
				.from(course)
				.where(input.includeArchived ? undefined : isNull(course.archivedAt))
				.orderBy(asc(course.title)),
		),
	search: permissionProcedure("content:create")
		.input(z.object({ query: z.string().trim().max(100).default("") }))
		.handler(({ context, input }) => {
			const searchPattern = `%${input.query}%`;
			return db
				.select({
					gradeLevel: course.gradeLevel,
					id: course.id,
					title: course.title,
				})
				.from(course)
				.where(
					and(
						isNull(course.archivedAt),
						context.role === "admin"
							? undefined
							: eq(course.createdBy, context.session.user.id),
						input.query
							? or(
									ilike(course.title, searchPattern),
									ilike(course.description, searchPattern),
								)
							: undefined,
					),
				)
				.orderBy(desc(course.updatedAt))
				.limit(20);
		}),
	update: adminProcedure.input(updateCourseInput).handler(async ({ input }) => {
		const { courseId, ...values } = input;
		const [updatedCourse] = await db
			.update(course)
			.set(values)
			.where(and(eq(course.id, courseId), isNull(course.archivedAt)))
			.returning(courseFields);
		if (!updatedCourse) {
			throw new ORPCError("NOT_FOUND", {
				message: "Active course not found.",
			});
		}
		return updatedCourse;
	}),
};
