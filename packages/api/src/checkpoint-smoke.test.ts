import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import type { ApiContext } from "./index";

dotenv.config({ path: "apps/server/.env" });

const { classroom, course, db, learnerSkillMastery, recommendationRun, user } =
	await import("@MindBridge/db");
const { demoSeedIds, seedDemoData } = await import("@MindBridge/db/seed");
const { appRouter } = await import("./routers/index");

const hasDatabase = Boolean(process.env.DATABASE_URL);

const contextFor = (id: string, role: string): ApiContext => ({
	contentGeneration: {
		async *generateLessonDraft() {
			yield {
				generationId: randomUUID(),
				message: "Not available in the checkpoint smoke test.",
				type: "failed" as const,
			};
		},
	},
	courseCatalog: { search: async () => [] },
	documentIngestion: {
		ingest: async () => ({
			chunkCount: 0,
			documentId: randomUUID(),
			preview: "",
			type: "success" as const,
		}),
		ingestText: async () => ({
			chunkCount: 0,
			documentId: randomUUID(),
			preview: "",
			type: "success" as const,
		}),
	},
	session: { user: { id, role } },
});

describe.skipIf(!hasDatabase)("checkpoint demo flow", () => {
	const suffix = randomUUID();
	const adminId = `smoke-admin-${suffix}`;
	const teacherId = `smoke-teacher-${suffix}`;
	const learnerId = `smoke-learner-${suffix}`;
	const learnerEmail = `smoke-${suffix}@mindbridge.local`;
	let createdClassroomId: string | undefined;
	let createdCourseId: string | undefined;

	afterAll(async () => {
		if (createdClassroomId) {
			await db.delete(classroom).where(eq(classroom.id, createdClassroomId));
		}
		if (createdCourseId) {
			await db.delete(course).where(eq(course.id, createdCourseId));
		}
		await db
			.delete(recommendationRun)
			.where(eq(recommendationRun.learnerId, learnerId));
		await db
			.delete(user)
			.where(inArray(user.id, [adminId, teacherId, learnerId]));
		await db.$client.end();
	});

	it("seeds twice without duplicating deterministic demo records", async () => {
		await seedDemoData();
		await seedDemoData();

		const [seedUsers, seedCourses, seedClassrooms] = await Promise.all([
			db
				.select({ id: user.id })
				.from(user)
				.where(
					inArray(user.id, [
						demoSeedIds.admin,
						demoSeedIds.teacher,
						demoSeedIds.learnerNeedsPrerequisite,
						demoSeedIds.learnerBuildingFluency,
						demoSeedIds.learnerReadyForAdvanced,
					]),
				),
			db
				.select({ id: course.id })
				.from(course)
				.where(eq(course.id, demoSeedIds.course)),
			db
				.select({ id: classroom.id })
				.from(classroom)
				.where(eq(classroom.id, demoSeedIds.classroom)),
		]);

		expect(seedUsers).toHaveLength(5);
		expect(seedCourses).toHaveLength(1);
		expect(seedClassrooms).toHaveLength(1);
	});

	it("covers admin, teacher, and learner checkpoint actions", async () => {
		await seedDemoData();
		await db.insert(user).values([
			{
				email: `admin-${suffix}@mindbridge.local`,
				id: adminId,
				name: "Smoke Admin",
				role: "admin",
			},
			{
				email: `teacher-${suffix}@mindbridge.local`,
				id: teacherId,
				name: "Smoke Teacher",
				role: "teacher",
			},
			{
				email: learnerEmail,
				id: learnerId,
				name: "Smoke Learner",
				role: "learner",
			},
		]);
		await db.insert(learnerSkillMastery).values({
			evidenceCount: 1,
			learnerId,
			score: 0.2,
			skillId: demoSeedIds.conditionSkill,
		});

		const adminContext = contextFor(adminId, "admin");
		const teacherContext = contextFor(teacherId, "teacher");
		const learnerContext = contextFor(learnerId, "learner");
		const createCourse = appRouter.courses.create.callable({
			context: adminContext,
		});
		const createDraft = appRouter.contentWorkflow.createDraft.callable({
			context: teacherContext,
		});
		const createClassroom = appRouter.teacher.createClassroom.callable({
			context: teacherContext,
		});
		const addEnrollment = appRouter.teacher.addEnrollment.callable({
			context: teacherContext,
		});
		const publishAndAssignGeneratedLesson =
			appRouter.teacher.publishAndAssignGeneratedLesson.callable({
				context: teacherContext,
			});
		const searchCourses = appRouter.courses.search.callable({
			context: teacherContext,
		});
		const listCourses = appRouter.learner.listCourses.callable({
			context: learnerContext,
		});
		const getCourse = appRouter.learner.getCourse.callable({
			context: learnerContext,
		});
		const completeLesson = appRouter.learner.completeLesson.callable({
			context: learnerContext,
		});
		const listInbox = appRouter.assignments.listInbox.callable({
			context: learnerContext,
		});
		const generateRecommendations = appRouter.recommendation.generate.callable({
			context: learnerContext,
		});
		const latestRecommendations = appRouter.recommendation.latest.callable({
			context: learnerContext,
		});

		const createdCourse = await createCourse({
			description: "Checkpoint smoke course",
			gradeLevel: 6,
			language: "vi",
			title: `Checkpoint ${suffix}`,
		});
		createdCourseId = createdCourse.id;
		const createdClassroom = await createClassroom({
			courseId: createdCourse.id,
			name: `Checkpoint class ${suffix}`,
		});
		createdClassroomId = createdClassroom?.id;
		expect(createdClassroom).toBeDefined();
		if (!createdClassroom) throw new Error("Classroom was not created.");
		await addEnrollment({
			classroomId: createdClassroom.id,
			email: learnerEmail,
		});
		const visibleCourses = await searchCourses({ query: "Checkpoint" });
		expect(visibleCourses.some(({ id }) => id === createdCourse.id)).toBe(true);

		const draft = await createDraft({
			body: { sections: [{ content: "Checkpoint lesson" }] },
			courseId: createdCourse.id,
			kind: "lesson",
			metadata: { difficulty: "beginner", gradeLevel: 6 },
			title: "Checkpoint lesson",
		});
		const publishedAssignment = await publishAndAssignGeneratedLesson({
			classroomId: createdClassroom.id,
			contentVersionId: draft.version.id,
		});
		expect(publishedAssignment.assignment.id).toBeTypeOf("string");

		expect(publishedAssignment.publishedVersion.id).toBe(draft.version.id);

		const learnerCourses = await listCourses();
		expect(
			learnerCourses.some(({ courseId }) => courseId === createdCourse.id),
		).toBe(true);
		const openedCourse = await getCourse({ classroomId: createdClassroom.id });
		expect(openedCourse.content).toHaveLength(1);
		const inbox = await listInbox();
		expect(inbox.some(({ contentId }) => contentId === draft.content.id)).toBe(
			true,
		);
		await completeLesson({
			classroomId: createdClassroom.id,
			contentId: draft.content.id,
		});
		const completedCourse = await getCourse({
			classroomId: createdClassroom.id,
		});
		expect(completedCourse.content[0]?.isCompleted).toBe(true);

		const generated = await generateRecommendations({ limit: 2 });
		expect(generated.run?.learnerId).toBe(learnerId);
		expect(generated.recommendations).toBeInstanceOf(Array);
		const latest = await latestRecommendations();
		expect(latest?.run?.learnerId).toBe(learnerId);
	});
});
