import {
	classroom,
	classroomEnrollment,
	classroomGroup,
	classroomGroupMember,
	contentAssignment,
	contentReviewEvent,
	contentVersion,
	course,
	courseContent,
	db,
	learnerSkillMastery,
	learningContent,
	skill,
	teacherFeedback,
	user,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, ilike, inArray, max } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure } from "../index";

const classroomInput = z.object({
	classroomId: z.string().uuid().optional(),
});

const classroomIdInput = z.object({
	classroomId: z.string().uuid(),
});

const classroomDetailsInput = z.object({
	courseId: z.string().uuid(),
	name: z.string().trim().min(1).max(120),
});

const enrollmentInput = z.object({
	classroomId: z.string().uuid(),
	email: z.string().trim().toLowerCase().email(),
});

const groupDetailsInput = z.object({
	classroomId: z.string().uuid(),
	name: z.string().trim().min(1).max(120),
});

const groupIdInput = z.object({
	groupId: z.string().uuid(),
});

const groupMemberInput = groupIdInput.extend({
	learnerId: z.string().trim().min(1),
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

const publishGeneratedLessonInput = z.object({
	classroomId: z.string().uuid(),
	contentVersionId: z.string().uuid(),
	dueAt: z.coerce.date().optional(),
});

const feedbackIdInput = z.object({ feedbackId: z.string().uuid() });

const feedbackValues = z.object({
	note: z.string().trim().min(1).max(5000),
});

const createFeedbackInput = feedbackValues.extend({
	classroomId: z.string().uuid(),
	learnerId: z.string().trim().min(1),
});

const teacherProcedure = permissionProcedure("class:read").use(
	async ({ context, next }) => {
		if (context.role !== "teacher") {
			throw new ORPCError("FORBIDDEN", {
				message: "This procedure is only available to teachers.",
			});
		}
		return next({ context });
	},
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
			courseTitle: course.title,
			id: classroom.id,
			name: classroom.name,
			courseId: classroom.courseId,
		})
		.from(classroom)
		.innerJoin(course, eq(course.id, classroom.courseId))
		.where(and(...conditions));
};

const requireTeacherClassroom = async (
	teacherId: string,
	classroomId: string,
) => {
	const [ownedClassroom] = await getTeacherClassrooms(teacherId, classroomId);
	if (!ownedClassroom) {
		throw new ORPCError("NOT_FOUND", { message: "Classroom not found." });
	}
	return ownedClassroom;
};

const requireTeacherGroup = async (teacherId: string, groupId: string) => {
	const [ownedGroup] = await db
		.select({
			classroomId: classroomGroup.classroomId,
			id: classroomGroup.id,
			name: classroomGroup.name,
		})
		.from(classroomGroup)
		.innerJoin(classroom, eq(classroom.id, classroomGroup.classroomId))
		.where(
			and(eq(classroomGroup.id, groupId), eq(classroom.teacherId, teacherId)),
		)
		.limit(1);
	if (!ownedGroup) {
		throw new ORPCError("NOT_FOUND", { message: "Group not found." });
	}
	return ownedGroup;
};

const requireActiveLearner = async (
	teacherId: string,
	classroomId: string,
	learnerId: string,
) => {
	await requireTeacherClassroom(teacherId, classroomId);
	const [enrollment] = await db
		.select({ learnerId: classroomEnrollment.learnerId })
		.from(classroomEnrollment)
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
			message: "Active learner enrollment not found.",
		});
	}
	return enrollment;
};

export const teacherRouter = {
	addGroupMember: permissionProcedure("class:read")
		.input(groupMemberInput)
		.handler(async ({ context, input }) => {
			const group = await requireTeacherGroup(
				context.session.user.id,
				input.groupId,
			);
			const [enrollment] = await db
				.select({ learnerId: classroomEnrollment.learnerId })
				.from(classroomEnrollment)
				.where(
					and(
						eq(classroomEnrollment.classroomId, group.classroomId),
						eq(classroomEnrollment.learnerId, input.learnerId),
						eq(classroomEnrollment.status, "active"),
					),
				)
				.limit(1);
			if (!enrollment) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Only active learners enrolled in this classroom can be added.",
				});
			}

			const [createdMember] = await db
				.insert(classroomGroupMember)
				.values({ groupId: input.groupId, learnerId: input.learnerId })
				.onConflictDoNothing()
				.returning();
			return (
				createdMember ?? {
					groupId: input.groupId,
					learnerId: input.learnerId,
				}
			);
		}),
	addEnrollment: permissionProcedure("class:read")
		.input(enrollmentInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			const [learner] = await db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(ilike(user.email, input.email))
				.limit(1);
			if (learner?.role !== "learner") {
				throw new ORPCError("NOT_FOUND", {
					message: "No learner account was found for this email.",
				});
			}

			const [enrollment] = await db
				.insert(classroomEnrollment)
				.values({
					classroomId: input.classroomId,
					learnerId: learner.id,
					status: "active",
				})
				.onConflictDoUpdate({
					set: { status: "active" },
					target: [
						classroomEnrollment.classroomId,
						classroomEnrollment.learnerId,
					],
				})
				.returning();
			return enrollment;
		}),
	publishAndAssignGeneratedLesson: teacherProcedure
		.input(publishGeneratedLessonInput)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				const [ownedClassroom] = await transaction
					.select({ courseId: classroom.courseId })
					.from(classroom)
					.where(
						and(
							eq(classroom.id, input.classroomId),
							eq(classroom.teacherId, context.session.user.id),
						),
					)
					.limit(1);
				if (!ownedClassroom) {
					throw new ORPCError("FORBIDDEN", {
						message: "You can only assign content to your own classrooms.",
					});
				}

				const [generatedVersion] = await transaction
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
				if (!generatedVersion) {
					throw new ORPCError("NOT_FOUND", {
						message: "Generated lesson draft not found.",
					});
				}
				if (generatedVersion.status !== "draft") {
					throw new ORPCError("CONFLICT", {
						message: "Only generated drafts can be published and assigned.",
					});
				}
				if (generatedVersion.courseId !== ownedClassroom.courseId) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Học liệu không thuộc khóa học của lớp này.",
					});
				}

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
						message: "Draft status changed before it could be assigned.",
					});
				}

				await transaction.insert(contentReviewEvent).values({
					actorId: context.session.user.id,
					contentVersionId: publishedVersion.id,
					fromStatus: "draft",
					toStatus: "published",
				});
				const [lastPosition] = await transaction
					.select({ value: max(courseContent.position) })
					.from(courseContent)
					.where(eq(courseContent.courseId, ownedClassroom.courseId));
				const [curriculumItem] = await transaction
					.insert(courseContent)
					.values({
						contentId: generatedVersion.contentId,
						courseId: ownedClassroom.courseId,
						position: (lastPosition?.value ?? 0) + 1,
					})
					.returning();
				if (!curriculumItem) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Learning content could not be added to the course.",
					});
				}

				const [assignment] = await transaction
					.insert(contentAssignment)
					.values({
						assignedBy: context.session.user.id,
						classroomId: input.classroomId,
						contentVersionId: publishedVersion.id,
						dueAt: input.dueAt,
					})
					.returning();
				if (!assignment) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Learning content could not be assigned.",
					});
				}
				return { assignment, curriculumItem, publishedVersion };
			}),
		),
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
				const [ownedClassroom] = classrooms;
				if (!ownedClassroom) {
					throw new ORPCError("FORBIDDEN", {
						message: "You can only assign content to your own classrooms.",
					});
				}
				const [courseContentVersion] = await db
					.select({ id: contentVersion.id })
					.from(contentVersion)
					.innerJoin(
						learningContent,
						eq(learningContent.id, contentVersion.contentId),
					)
					.innerJoin(
						courseContent,
						and(
							eq(courseContent.contentId, learningContent.id),
							eq(courseContent.courseId, ownedClassroom.courseId),
						),
					)
					.where(eq(contentVersion.id, input.contentVersionId))
					.limit(1);
				if (!courseContentVersion) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Học liệu không thuộc khóa học của lớp này.",
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
	listAssignableContent: permissionProcedure("assignment:create")
		.input(classroomIdInput)
		.handler(async ({ context, input }) => {
			const ownedClassroom = await requireTeacherClassroom(
				context.session.user.id,
				input.classroomId,
			);
			return db
				.select({
					id: contentVersion.id,
					title: learningContent.title,
				})
				.from(courseContent)
				.innerJoin(
					learningContent,
					eq(learningContent.id, courseContent.contentId),
				)
				.innerJoin(
					contentVersion,
					eq(contentVersion.contentId, learningContent.id),
				)
				.where(
					and(
						eq(courseContent.courseId, ownedClassroom.courseId),
						eq(contentVersion.status, "published"),
					),
				)
				.orderBy(asc(courseContent.position), asc(learningContent.title));
		}),
	archiveClassroom: permissionProcedure("class:read")
		.input(classroomIdInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			const [archivedClassroom] = await db
				.delete(classroom)
				.where(
					and(
						eq(classroom.id, input.classroomId),
						eq(classroom.teacherId, context.session.user.id),
					),
				)
				.returning({ id: classroom.id });
			return archivedClassroom;
		}),
	createClassroom: permissionProcedure("class:read")
		.input(classroomDetailsInput)
		.handler(async ({ context, input }) => {
			const [selectedCourse] = await db
				.select({ id: course.id })
				.from(course)
				.where(eq(course.id, input.courseId))
				.limit(1);
			if (!selectedCourse) {
				throw new ORPCError("NOT_FOUND", { message: "Course not found." });
			}
			const [createdClassroom] = await db
				.insert(classroom)
				.values({
					courseId: input.courseId,
					name: input.name,
					teacherId: context.session.user.id,
				})
				.returning();
			return createdClassroom;
		}),
	createGroup: permissionProcedure("class:read")
		.input(groupDetailsInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			const [createdGroup] = await db
				.insert(classroomGroup)
				.values({ classroomId: input.classroomId, name: input.name })
				.returning();
			return createdGroup;
		}),
	createFeedback: teacherProcedure
		.input(createFeedbackInput)
		.handler(async ({ context, input }) => {
			await requireActiveLearner(
				context.session.user.id,
				input.classroomId,
				input.learnerId,
			);
			const [createdFeedback] = await db
				.insert(teacherFeedback)
				.values({
					feedbackType: "content",
					learnerId: input.learnerId,
					note: input.note,
					teacherId: context.session.user.id,
				})
				.returning();
			if (!createdFeedback) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Feedback could not be created.",
				});
			}
			return createdFeedback;
		}),
	deactivateEnrollment: permissionProcedure("class:read")
		.input(enrollmentInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			const [enrollment] = await db
				.select({ learnerId: classroomEnrollment.learnerId })
				.from(classroomEnrollment)
				.innerJoin(user, eq(user.id, classroomEnrollment.learnerId))
				.where(
					and(
						eq(classroomEnrollment.classroomId, input.classroomId),
						ilike(user.email, input.email),
					),
				)
				.limit(1);
			if (!enrollment) {
				throw new ORPCError("NOT_FOUND", { message: "Enrollment not found." });
			}
			const [deactivatedEnrollment] = await db
				.update(classroomEnrollment)
				.set({ status: "withdrawn" })
				.where(
					and(
						eq(classroomEnrollment.classroomId, input.classroomId),
						eq(classroomEnrollment.learnerId, enrollment.learnerId),
					),
				)
				.returning();
			return deactivatedEnrollment;
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
				.where(
					and(
						inArray(classroomEnrollment.classroomId, classroomIds),
						eq(classroomEnrollment.status, "active"),
					),
				);
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
	listCourseOptions: permissionProcedure("class:read").handler(() =>
		db
			.select({ id: course.id, title: course.title })
			.from(course)
			.orderBy(asc(course.title)),
	),
	listEnrollments: permissionProcedure("class:read")
		.input(classroomIdInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			return db
				.select({
					createdAt: classroomEnrollment.createdAt,
					email: user.email,
					learnerId: classroomEnrollment.learnerId,
					learnerName: user.name,
					status: classroomEnrollment.status,
				})
				.from(classroomEnrollment)
				.innerJoin(user, eq(user.id, classroomEnrollment.learnerId))
				.where(eq(classroomEnrollment.classroomId, input.classroomId))
				.orderBy(asc(user.name));
		}),
	listGroups: permissionProcedure("class:read")
		.input(classroomIdInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			const groups = await db
				.select({
					createdAt: classroomGroup.createdAt,
					id: classroomGroup.id,
					name: classroomGroup.name,
				})
				.from(classroomGroup)
				.where(eq(classroomGroup.classroomId, input.classroomId))
				.orderBy(asc(classroomGroup.name));
			if (groups.length === 0) {
				return [];
			}

			const members = await db
				.select({
					email: user.email,
					groupId: classroomGroupMember.groupId,
					learnerId: classroomGroupMember.learnerId,
					learnerName: user.name,
				})
				.from(classroomGroupMember)
				.innerJoin(user, eq(user.id, classroomGroupMember.learnerId))
				.where(
					inArray(
						classroomGroupMember.groupId,
						groups.map(({ id }) => id),
					),
				)
				.orderBy(asc(user.name));

			return groups.map((group) => ({
				...group,
				members: members.filter(({ groupId }) => groupId === group.id),
			}));
		}),
	listFeedback: teacherProcedure
		.input(classroomIdInput)
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			return db
				.select({
					assignmentId: teacherFeedback.assignmentId,
					createdAt: teacherFeedback.createdAt,
					feedbackType: teacherFeedback.feedbackType,
					id: teacherFeedback.id,
					learnerId: teacherFeedback.learnerId,
					learnerName: user.name,
					note: teacherFeedback.note,
					recommendationId: teacherFeedback.recommendationId,
				})
				.from(teacherFeedback)
				.innerJoin(user, eq(user.id, teacherFeedback.learnerId))
				.innerJoin(
					classroomEnrollment,
					and(
						eq(classroomEnrollment.learnerId, teacherFeedback.learnerId),
						eq(classroomEnrollment.classroomId, input.classroomId),
					),
				)
				.where(eq(teacherFeedback.teacherId, context.session.user.id))
				.orderBy(desc(teacherFeedback.createdAt), desc(teacherFeedback.id));
		}),
	removeGroupMember: permissionProcedure("class:read")
		.input(groupMemberInput)
		.handler(async ({ context, input }) => {
			await requireTeacherGroup(context.session.user.id, input.groupId);
			const [removedMember] = await db
				.delete(classroomGroupMember)
				.where(
					and(
						eq(classroomGroupMember.groupId, input.groupId),
						eq(classroomGroupMember.learnerId, input.learnerId),
					),
				)
				.returning();
			if (!removedMember) {
				throw new ORPCError("NOT_FOUND", {
					message: "Group member not found.",
				});
			}
			return removedMember;
		}),
	deleteFeedback: teacherProcedure
		.input(feedbackIdInput)
		.handler(async ({ context, input }) => {
			const [deletedFeedback] = await db
				.delete(teacherFeedback)
				.where(
					and(
						eq(teacherFeedback.id, input.feedbackId),
						eq(teacherFeedback.teacherId, context.session.user.id),
					),
				)
				.returning({ id: teacherFeedback.id });
			if (!deletedFeedback) {
				throw new ORPCError("NOT_FOUND", { message: "Feedback not found." });
			}
			return deletedFeedback;
		}),
	deleteGroup: permissionProcedure("class:read")
		.input(groupIdInput)
		.handler(async ({ context, input }) => {
			await requireTeacherGroup(context.session.user.id, input.groupId);
			const [deletedGroup] = await db
				.delete(classroomGroup)
				.where(eq(classroomGroup.id, input.groupId))
				.returning({ id: classroomGroup.id });
			return deletedGroup;
		}),
	updateGroup: permissionProcedure("class:read")
		.input(groupIdInput.extend({ name: z.string().trim().min(1).max(120) }))
		.handler(async ({ context, input }) => {
			await requireTeacherGroup(context.session.user.id, input.groupId);
			const [updatedGroup] = await db
				.update(classroomGroup)
				.set({ name: input.name })
				.where(eq(classroomGroup.id, input.groupId))
				.returning();
			return updatedGroup;
		}),
	updateFeedback: teacherProcedure
		.input(feedbackIdInput.extend(feedbackValues.shape))
		.handler(async ({ context, input }) => {
			const [updatedFeedback] = await db
				.update(teacherFeedback)
				.set({ note: input.note })
				.where(
					and(
						eq(teacherFeedback.id, input.feedbackId),
						eq(teacherFeedback.teacherId, context.session.user.id),
					),
				)
				.returning();
			if (!updatedFeedback) {
				throw new ORPCError("NOT_FOUND", { message: "Feedback not found." });
			}
			return updatedFeedback;
		}),
	updateClassroom: permissionProcedure("class:read")
		.input(classroomDetailsInput.extend({ classroomId: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			await requireTeacherClassroom(context.session.user.id, input.classroomId);
			const [selectedCourse] = await db
				.select({ id: course.id })
				.from(course)
				.where(eq(course.id, input.courseId))
				.limit(1);
			if (!selectedCourse) {
				throw new ORPCError("NOT_FOUND", { message: "Course not found." });
			}
			const [updatedClassroom] = await db
				.update(classroom)
				.set({ courseId: input.courseId, name: input.name })
				.where(
					and(
						eq(classroom.id, input.classroomId),
						eq(classroom.teacherId, context.session.user.id),
					),
				)
				.returning();
			return updatedClassroom;
		}),
};
