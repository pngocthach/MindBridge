import {
	classroom,
	classroomEnrollment,
	classroomGroup,
	contentAssignment,
	contentVersion,
	db,
	learnerSkillMastery,
	skill,
	user,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure } from "../index";

const classroomInput = z.object({
	classroomId: z.string().uuid().optional(),
});

const assignmentInput = z
	.object({
		classroomId: z.string().uuid().optional(),
		contentVersionId: z.string().uuid(),
		dueAt: z.coerce.date().optional(),
		groupId: z.string().uuid().optional(),
		learnerId: z.string().trim().min(1).optional(),
	})
	.refine(
		(input) =>
			[input.classroomId, input.groupId, input.learnerId].filter(Boolean)
				.length === 1,
		{ message: "Choose exactly one classroom, group, or learner target." },
	);

const getTeacherClassrooms = async (
	teacherId: string,
	classroomId?: string,
) => {
	const conditions = [eq(classroom.teacherId, teacherId)];
	if (classroomId) {
		conditions.push(eq(classroom.id, classroomId));
	}

	return db
		.select({
			id: classroom.id,
			name: classroom.name,
			courseId: classroom.courseId,
		})
		.from(classroom)
		.where(and(...conditions));
};

export const teacherRouter = {
	assignContent: permissionProcedure("assignment:create")
		.input(assignmentInput)
		.handler(async ({ context, input }) => {
			const [publishedVersion] = await db
				.select({ id: contentVersion.id, status: contentVersion.status })
				.from(contentVersion)
				.where(eq(contentVersion.id, input.contentVersionId))
				.limit(1);

			if (!publishedVersion) {
				throw new ORPCError("NOT_FOUND", {
					message: "Content version not found.",
				});
			}
			if (publishedVersion.status !== "published") {
				throw new ORPCError("FORBIDDEN", {
					message: "Only published content can be assigned.",
				});
			}

			let target: {
				classroomId?: string;
				groupId?: string;
				learnerId?: string;
			};
			if (input.classroomId) {
				const classrooms = await getTeacherClassrooms(
					context.session.user.id,
					input.classroomId,
				);
				if (classrooms.length === 0) {
					throw new ORPCError("FORBIDDEN", {
						message: "You can only assign content to your own classrooms.",
					});
				}
				target = { classroomId: input.classroomId };
			} else if (input.groupId) {
				const [group] = await db
					.select({ classroomId: classroomGroup.classroomId })
					.from(classroomGroup)
					.innerJoin(classroom, eq(classroom.id, classroomGroup.classroomId))
					.where(
						and(
							eq(classroomGroup.id, input.groupId),
							eq(classroom.teacherId, context.session.user.id),
						),
					)
					.limit(1);
				if (!group) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"You can only assign content to groups in your classrooms.",
					});
				}
				target = { groupId: input.groupId };
			} else if (input.learnerId) {
				const [enrollment] = await db
					.select({ learnerId: classroomEnrollment.learnerId })
					.from(classroomEnrollment)
					.innerJoin(
						classroom,
						eq(classroom.id, classroomEnrollment.classroomId),
					)
					.where(
						and(
							eq(classroomEnrollment.learnerId, input.learnerId),
							eq(classroom.teacherId, context.session.user.id),
						),
					)
					.limit(1);
				if (!enrollment) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"You can only assign content to learners in your classrooms.",
					});
				}
				target = { learnerId: input.learnerId };
			} else {
				throw new ORPCError("BAD_REQUEST", {
					message: "An assignment target is required.",
				});
			}

			const [assignment] = await db
				.insert(contentAssignment)
				.values({
					assignedBy: context.session.user.id,
					contentVersionId: input.contentVersionId,
					dueAt: input.dueAt,
					...target,
				})
				.returning();

			return assignment;
		}),
	listClassrooms: permissionProcedure("class:read")
		.input(classroomInput)
		.handler(async ({ context, input }) => {
			const classrooms = await getTeacherClassrooms(
				context.session.user.id,
				input.classroomId,
			);
			if (input.classroomId && classrooms.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Classroom not found." });
			}
			if (classrooms.length === 0) {
				return [];
			}

			const classroomIds = classrooms.map(({ id }) => id);
			const enrollments = await db
				.select({
					classroomId: classroomEnrollment.classroomId,
					learnerId: classroomEnrollment.learnerId,
					learnerName: user.name,
				})
				.from(classroomEnrollment)
				.innerJoin(user, eq(user.id, classroomEnrollment.learnerId))
				.where(inArray(classroomEnrollment.classroomId, classroomIds));
			const learnerIds = enrollments.map(({ learnerId }) => learnerId);
			const mastery = learnerIds.length
				? await db
						.select({
							learnerId: learnerSkillMastery.learnerId,
							score: learnerSkillMastery.score,
							skillId: learnerSkillMastery.skillId,
							skillMasteryThreshold: skill.masteryThreshold,
							skillName: skill.name,
						})
						.from(learnerSkillMastery)
						.innerJoin(skill, eq(skill.id, learnerSkillMastery.skillId))
						.where(inArray(learnerSkillMastery.learnerId, learnerIds))
				: [];
			const masteryByLearner = new Map<string, typeof mastery>();
			for (const item of mastery) {
				const entries = masteryByLearner.get(item.learnerId) ?? [];
				entries.push(item);
				masteryByLearner.set(item.learnerId, entries);
			}

			return classrooms.map((currentClassroom) => ({
				...currentClassroom,
				learners: enrollments
					.filter(({ classroomId }) => classroomId === currentClassroom.id)
					.map(({ learnerId, learnerName }) => ({
						gaps: (masteryByLearner.get(learnerId) ?? [])
							.filter(
								({ score, skillMasteryThreshold }) =>
									score < skillMasteryThreshold,
							)
							.map(({ score, skillId, skillName }) => ({
								score,
								skillId,
								skillName,
							})),
						learnerId,
						learnerName,
					})),
			}));
		}),
};
