import {
	classroom,
	classroomEnrollment,
	classroomGroup,
	classroomGroupMember,
	contentAssignment,
	contentVersion,
	db,
	learnerLessonProgress,
	learningContent,
	user,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure } from "../index";

const assignmentIdInput = z.object({ assignmentId: z.string().uuid() });
const updateAssignmentInput = assignmentIdInput.extend({
	dueAt: z.coerce.date().nullable(),
});

const teacherAssignmentProcedure = permissionProcedure("assignment:create").use(
	async ({ context, next }) => {
		if (context.role !== "teacher") {
			throw new ORPCError("FORBIDDEN", {
				message: "This procedure is only available to teachers.",
			});
		}
		return next({ context });
	},
);

const learnerAssignmentProcedure = permissionProcedure("learning:read").use(
	async ({ context, next }) => {
		if (context.role !== "learner") {
			throw new ORPCError("FORBIDDEN", {
				message: "This procedure is only available to learners.",
			});
		}
		return next({ context });
	},
);

const listTeacherAssignments = async (teacherId: string) => {
	const assignments = await db
		.select({
			classroomId: contentAssignment.classroomId,
			contentId: learningContent.id,
			contentVersionId: contentAssignment.contentVersionId,
			createdAt: contentAssignment.createdAt,
			dueAt: contentAssignment.dueAt,
			groupId: contentAssignment.groupId,
			id: contentAssignment.id,
			learnerId: contentAssignment.learnerId,
			title: learningContent.title,
		})
		.from(contentAssignment)
		.innerJoin(
			contentVersion,
			eq(contentVersion.id, contentAssignment.contentVersionId),
		)
		.innerJoin(
			learningContent,
			eq(learningContent.id, contentVersion.contentId),
		)
		.where(eq(contentAssignment.assignedBy, teacherId))
		.orderBy(desc(contentAssignment.createdAt));

	const classroomIds = assignments.flatMap(({ classroomId }) =>
		classroomId ? [classroomId] : [],
	);
	const groupIds = assignments.flatMap(({ groupId }) =>
		groupId ? [groupId] : [],
	);
	const learnerIds = assignments.flatMap(({ learnerId }) =>
		learnerId ? [learnerId] : [],
	);
	const groups = groupIds.length
		? await db
				.select({
					classroomId: classroomGroup.classroomId,
					id: classroomGroup.id,
					name: classroomGroup.name,
				})
				.from(classroomGroup)
				.where(inArray(classroomGroup.id, groupIds))
		: [];
	const allClassroomIds = [
		...new Set([
			...classroomIds,
			...groups.map(({ classroomId }) => classroomId),
		]),
	];
	const [classrooms, learners] = await Promise.all([
		allClassroomIds.length
			? db
					.select({ id: classroom.id, name: classroom.name })
					.from(classroom)
					.where(inArray(classroom.id, allClassroomIds))
			: [],
		learnerIds.length
			? db
					.select({ id: user.id, name: user.name })
					.from(user)
					.where(inArray(user.id, learnerIds))
			: [],
	]);
	const classroomNames = new Map(
		classrooms.map((item) => [item.id, item.name]),
	);
	const groupDetails = new Map(groups.map((item) => [item.id, item]));
	const learnerNames = new Map(learners.map((item) => [item.id, item.name]));

	return assignments.map((assignment) => {
		if (assignment.classroomId) {
			return {
				...assignment,
				targetName:
					classroomNames.get(assignment.classroomId) ?? "Unknown classroom",
				targetType: "classroom" as const,
			};
		}
		if (assignment.groupId) {
			const group = groupDetails.get(assignment.groupId);
			return {
				...assignment,
				classroomId: group?.classroomId ?? null,
				targetName: group?.name ?? "Unknown group",
				targetType: "group" as const,
			};
		}
		return {
			...assignment,
			targetName:
				(assignment.learnerId && learnerNames.get(assignment.learnerId)) ??
				"Unknown learner",
			targetType: "learner" as const,
		};
	});
};

const listLearnerInbox = async (learnerId: string) => {
	const enrollments = await db
		.select({
			classroomId: classroomEnrollment.classroomId,
			classroomName: classroom.name,
			courseId: classroom.courseId,
		})
		.from(classroomEnrollment)
		.innerJoin(classroom, eq(classroom.id, classroomEnrollment.classroomId))
		.where(
			and(
				eq(classroomEnrollment.learnerId, learnerId),
				eq(classroomEnrollment.status, "active"),
			),
		);
	const classroomIds = enrollments.map(({ classroomId }) => classroomId);
	const groups = classroomIds.length
		? await db
				.select({
					classroomId: classroomGroup.classroomId,
					groupId: classroomGroup.id,
					groupName: classroomGroup.name,
				})
				.from(classroomGroupMember)
				.innerJoin(
					classroomGroup,
					eq(classroomGroup.id, classroomGroupMember.groupId),
				)
				.where(
					and(
						eq(classroomGroupMember.learnerId, learnerId),
						inArray(classroomGroup.classroomId, classroomIds),
					),
				)
		: [];
	const groupIds = groups.map(({ groupId }) => groupId);
	const targetConditions = [eq(contentAssignment.learnerId, learnerId)];
	if (classroomIds.length > 0) {
		targetConditions.push(inArray(contentAssignment.classroomId, classroomIds));
	}
	if (groupIds.length > 0) {
		targetConditions.push(inArray(contentAssignment.groupId, groupIds));
	}

	const assignments = await db
		.select({
			classroomId: contentAssignment.classroomId,
			contentId: learningContent.id,
			contentVersionId: contentAssignment.contentVersionId,
			courseId: learningContent.courseId,
			createdAt: contentAssignment.createdAt,
			dueAt: contentAssignment.dueAt,
			groupId: contentAssignment.groupId,
			id: contentAssignment.id,
			title: learningContent.title,
		})
		.from(contentAssignment)
		.innerJoin(
			contentVersion,
			eq(contentVersion.id, contentAssignment.contentVersionId),
		)
		.innerJoin(
			learningContent,
			eq(learningContent.id, contentVersion.contentId),
		)
		.where(or(...targetConditions))
		.orderBy(asc(contentAssignment.dueAt), desc(contentAssignment.createdAt));
	if (assignments.length === 0) {
		return [];
	}

	const contentIds = [
		...new Set(assignments.map(({ contentId }) => contentId)),
	];
	const progress = await db
		.select({ contentId: learnerLessonProgress.contentId })
		.from(learnerLessonProgress)
		.where(
			and(
				eq(learnerLessonProgress.learnerId, learnerId),
				inArray(learnerLessonProgress.contentId, contentIds),
			),
		);
	const completedContentIds = new Set(
		progress.map(({ contentId }) => contentId),
	);
	const classroomNames = new Map(
		enrollments.map((item) => [item.classroomId, item.classroomName]),
	);
	const groupDetails = new Map(groups.map((item) => [item.groupId, item]));

	return assignments.map((assignment) => {
		const group = assignment.groupId
			? groupDetails.get(assignment.groupId)
			: undefined;
		const directAssignmentClassroomId = enrollments.find(
			({ courseId }) => courseId === assignment.courseId,
		)?.classroomId;
		const resolvedClassroomId =
			assignment.classroomId ??
			group?.classroomId ??
			directAssignmentClassroomId;
		return {
			...assignment,
			classroomId: resolvedClassroomId ?? null,
			classroomName: resolvedClassroomId
				? (classroomNames.get(resolvedClassroomId) ?? null)
				: null,
			groupName: group?.groupName ?? null,
			status: completedContentIds.has(assignment.contentId)
				? ("completed" as const)
				: ("pending" as const),
		};
	});
};

export const assignmentRouter = {
	delete: teacherAssignmentProcedure
		.input(assignmentIdInput)
		.handler(async ({ context, input }) => {
			const [deletedAssignment] = await db
				.delete(contentAssignment)
				.where(
					and(
						eq(contentAssignment.id, input.assignmentId),
						eq(contentAssignment.assignedBy, context.session.user.id),
					),
				)
				.returning({ id: contentAssignment.id });
			if (!deletedAssignment) {
				throw new ORPCError("NOT_FOUND", { message: "Assignment not found." });
			}
			return deletedAssignment;
		}),
	listInbox: learnerAssignmentProcedure.handler(({ context }) =>
		listLearnerInbox(context.session.user.id),
	),
	listTeacher: teacherAssignmentProcedure.handler(({ context }) =>
		listTeacherAssignments(context.session.user.id),
	),
	update: teacherAssignmentProcedure
		.input(updateAssignmentInput)
		.handler(async ({ context, input }) => {
			const [updatedAssignment] = await db
				.update(contentAssignment)
				.set({ dueAt: input.dueAt })
				.where(
					and(
						eq(contentAssignment.id, input.assignmentId),
						eq(contentAssignment.assignedBy, context.session.user.id),
					),
				)
				.returning();
			if (!updatedAssignment) {
				throw new ORPCError("NOT_FOUND", { message: "Assignment not found." });
			}
			return updatedAssignment;
		}),
};
