import {
	classroom,
	classroomEnrollment,
	contentVersion,
	course,
	courseContent,
	db,
	learnerLessonProgress,
	learningContent,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure } from "../index";

const classroomInput = z.object({ classroomId: z.string().uuid() });
const lessonInput = classroomInput.extend({ contentId: z.string().uuid() });

const learnerProcedure = permissionProcedure("learning:read").use(
	async ({ context, next }) => {
		if (context.role !== "learner") {
			throw new ORPCError("FORBIDDEN", {
				message: "This procedure is only available to learners.",
			});
		}

		return next({ context });
	},
);

const getActiveEnrollment = async (learnerId: string, classroomId: string) => {
	const [enrollment] = await db
		.select({
			classroomId: classroom.id,
			classroomName: classroom.name,
			courseDescription: course.description,
			courseGradeLevel: course.gradeLevel,
			courseId: course.id,
			courseLanguage: course.language,
			courseTitle: course.title,
		})
		.from(classroomEnrollment)
		.innerJoin(classroom, eq(classroom.id, classroomEnrollment.classroomId))
		.innerJoin(course, eq(course.id, classroom.courseId))
		.where(
			and(
				eq(classroomEnrollment.classroomId, classroomId),
				eq(classroomEnrollment.learnerId, learnerId),
				eq(classroomEnrollment.status, "active"),
			),
		)
		.limit(1);

	if (!enrollment) {
		throw new ORPCError("NOT_FOUND", {
			message: "Active classroom course not found.",
		});
	}

	return enrollment;
};

const getPublishedCourseContent = async (
	courseId: string,
	learnerId: string,
) => {
	const rows = await db
		.select({
			body: contentVersion.body,
			completedAt: learnerLessonProgress.completedAt,
			contentId: learningContent.id,
			contentVersionId: contentVersion.id,
			isRequired: courseContent.isRequired,
			kind: learningContent.kind,
			metadata: contentVersion.metadata,
			position: courseContent.position,
			publishedAt: contentVersion.publishedAt,
			title: learningContent.title,
			versionNumber: contentVersion.versionNumber,
		})
		.from(courseContent)
		.innerJoin(
			learningContent,
			and(
				eq(learningContent.id, courseContent.contentId),
				eq(learningContent.courseId, courseContent.courseId),
			),
		)
		.innerJoin(contentVersion, eq(contentVersion.contentId, learningContent.id))
		.leftJoin(
			learnerLessonProgress,
			and(
				eq(learnerLessonProgress.contentId, learningContent.id),
				eq(learnerLessonProgress.learnerId, learnerId),
			),
		)
		.where(
			and(
				eq(courseContent.courseId, courseId),
				eq(contentVersion.status, "published"),
			),
		)
		.orderBy(
			asc(courseContent.position),
			desc(contentVersion.versionNumber),
			desc(contentVersion.id),
		);

	const latestPublishedContent = [];
	const seenContentIds = new Set<string>();
	for (const row of rows) {
		if (seenContentIds.has(row.contentId)) {
			continue;
		}
		seenContentIds.add(row.contentId);
		latestPublishedContent.push({
			...row,
			isCompleted: row.completedAt !== null,
		});
	}

	return latestPublishedContent;
};

export const learnerRouter = {
	completeLesson: learnerProcedure
		.input(lessonInput)
		.handler(async ({ context, input }) => {
			const learnerId = context.session.user.id;
			const enrollment = await getActiveEnrollment(
				learnerId,
				input.classroomId,
			);
			const [publishedLesson] = await db
				.select({ contentId: learningContent.id })
				.from(courseContent)
				.innerJoin(
					learningContent,
					and(
						eq(learningContent.id, courseContent.contentId),
						eq(learningContent.courseId, courseContent.courseId),
					),
				)
				.innerJoin(
					contentVersion,
					eq(contentVersion.contentId, learningContent.id),
				)
				.where(
					and(
						eq(courseContent.courseId, enrollment.courseId),
						eq(learningContent.id, input.contentId),
						eq(contentVersion.status, "published"),
					),
				)
				.limit(1);

			if (!publishedLesson) {
				throw new ORPCError("NOT_FOUND", {
					message: "Published lesson not found in this classroom course.",
				});
			}

			const [progress] = await db
				.insert(learnerLessonProgress)
				.values({ contentId: input.contentId, learnerId })
				.onConflictDoUpdate({
					set: { updatedAt: new Date() },
					target: [
						learnerLessonProgress.learnerId,
						learnerLessonProgress.contentId,
					],
				})
				.returning({
					completedAt: learnerLessonProgress.completedAt,
					contentId: learnerLessonProgress.contentId,
				});

			return { ...progress, isCompleted: true };
		}),
	getCourse: learnerProcedure
		.input(classroomInput)
		.handler(async ({ context, input }) => {
			const learnerId = context.session.user.id;
			const enrollment = await getActiveEnrollment(
				learnerId,
				input.classroomId,
			);
			const content = await getPublishedCourseContent(
				enrollment.courseId,
				learnerId,
			);
			const firstIncomplete = content.find((item) => !item.isCompleted);

			return {
				...enrollment,
				completedCount: content.filter((item) => item.isCompleted).length,
				content,
				resumeContentId:
					firstIncomplete?.contentId ?? content.at(-1)?.contentId,
				totalCount: content.length,
			};
		}),
	listCourses: learnerProcedure.handler(async ({ context }) => {
		const learnerId = context.session.user.id;
		const enrollments = await db
			.select({
				classroomId: classroom.id,
				classroomName: classroom.name,
				courseDescription: course.description,
				courseGradeLevel: course.gradeLevel,
				courseId: course.id,
				courseLanguage: course.language,
				courseTitle: course.title,
				enrolledAt: classroomEnrollment.createdAt,
			})
			.from(classroomEnrollment)
			.innerJoin(classroom, eq(classroom.id, classroomEnrollment.classroomId))
			.innerJoin(course, eq(course.id, classroom.courseId))
			.where(
				and(
					eq(classroomEnrollment.learnerId, learnerId),
					eq(classroomEnrollment.status, "active"),
				),
			)
			.orderBy(asc(course.title), asc(classroom.name), asc(classroom.id));

		if (enrollments.length === 0) {
			return [];
		}

		const courseIds = [...new Set(enrollments.map((item) => item.courseId))];
		const progressRows = await db
			.select({
				completedAt: learnerLessonProgress.completedAt,
				contentId: learningContent.id,
				courseId: courseContent.courseId,
			})
			.from(courseContent)
			.innerJoin(
				learningContent,
				and(
					eq(learningContent.id, courseContent.contentId),
					eq(learningContent.courseId, courseContent.courseId),
				),
			)
			.innerJoin(
				contentVersion,
				eq(contentVersion.contentId, learningContent.id),
			)
			.leftJoin(
				learnerLessonProgress,
				and(
					eq(learnerLessonProgress.contentId, learningContent.id),
					eq(learnerLessonProgress.learnerId, learnerId),
				),
			)
			.where(
				and(
					inArray(courseContent.courseId, courseIds),
					eq(contentVersion.status, "published"),
				),
			);

		const totalsByCourse = new Map<string, Set<string>>();
		const completedByCourse = new Map<string, Set<string>>();
		for (const row of progressRows) {
			const total = totalsByCourse.get(row.courseId) ?? new Set<string>();
			total.add(row.contentId);
			totalsByCourse.set(row.courseId, total);
			if (row.completedAt) {
				const completed =
					completedByCourse.get(row.courseId) ?? new Set<string>();
				completed.add(row.contentId);
				completedByCourse.set(row.courseId, completed);
			}
		}

		return enrollments.map((enrollment) => {
			const totalCount = totalsByCourse.get(enrollment.courseId)?.size ?? 0;
			const completedCount =
				completedByCourse.get(enrollment.courseId)?.size ?? 0;

			return {
				...enrollment,
				completedCount,
				progressPercent:
					totalCount === 0
						? 0
						: Math.round((completedCount / totalCount) * 100),
				totalCount,
			};
		});
	}),
	listLessonProgress: learnerProcedure
		.input(classroomInput)
		.handler(async ({ context, input }) => {
			const learnerId = context.session.user.id;
			const enrollment = await getActiveEnrollment(
				learnerId,
				input.classroomId,
			);
			const content = await getPublishedCourseContent(
				enrollment.courseId,
				learnerId,
			);

			return content.map((item) => ({
				completedAt: item.completedAt,
				contentId: item.contentId,
				isCompleted: item.isCompleted,
			}));
		}),
};
