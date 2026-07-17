import { db } from "./index";
import {
	assessmentItem,
	assessmentOption,
	attemptResponse,
	classroom,
	classroomEnrollment,
	contentSkill,
	contentVersion,
	course,
	courseContent,
	courseSkill,
	learnerProfile,
	learnerSkillMastery,
	learningAttempt,
	learningContent,
	masteryEvidence,
	recommendation,
	recommendationRun,
	skill,
	skillPrerequisite,
	user,
} from "./schema";

const ids = {
	admin: "seed-admin",
	teacher: "seed-teacher",
	learnerNeedsPrerequisite: "seed-learner-prerequisite",
	learnerReadyForAdvanced: "seed-learner-advanced",
	course: "00000000-0000-4000-8000-000000000001",
	variableSkill: "00000000-0000-4000-8000-000000000011",
	conditionSkill: "00000000-0000-4000-8000-000000000012",
	loopSkill: "00000000-0000-4000-8000-000000000013",
	conditionContent: "00000000-0000-4000-8000-000000000021",
	loopContent: "00000000-0000-4000-8000-000000000022",
	advancedLoopContent: "00000000-0000-4000-8000-000000000023",
	conditionVersion: "00000000-0000-4000-8000-000000000031",
	loopVersion: "00000000-0000-4000-8000-000000000032",
	advancedLoopVersion: "00000000-0000-4000-8000-000000000033",
	classroom: "00000000-0000-4000-8000-000000000041",
	loopQuestion: "00000000-0000-4000-8000-000000000051",
	loopCorrectOption: "00000000-0000-4000-8000-000000000061",
	attempt: "00000000-0000-4000-8000-000000000071",
	response: "00000000-0000-4000-8000-000000000081",
	evidence: "00000000-0000-4000-8000-000000000082",
	recommendationRun: "00000000-0000-4000-8000-000000000091",
	recommendation: "00000000-0000-4000-8000-000000000101",
} as const;

async function seed(): Promise<void> {
	await db
		.insert(user)
		.values([
			{
				id: ids.admin,
				name: "MindBridge Admin",
				email: "admin.seed@mindbridge.local",
				role: "admin",
			},
			{
				id: ids.teacher,
				name: "Cô Minh",
				email: "teacher.seed@mindbridge.local",
				role: "teacher",
			},
			{
				id: ids.learnerNeedsPrerequisite,
				name: "An Nguyễn",
				email: "an.seed@mindbridge.local",
				role: "learner",
			},
			{
				id: ids.learnerReadyForAdvanced,
				name: "Bình Trần",
				email: "binh.seed@mindbridge.local",
				role: "learner",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(course)
		.values({
			id: ids.course,
			title: "Lập trình Python cơ bản",
			description:
				"Khóa học tiếng Việt về tư duy lập trình cho học sinh lớp 6.",
			gradeLevel: 6,
			createdBy: ids.admin,
		})
		.onConflictDoNothing();

	await db
		.insert(skill)
		.values([
			{
				id: ids.variableSkill,
				slug: "python-variables",
				name: "Biến",
				description: "Lưu và sử dụng dữ liệu bằng biến.",
				gradeLevel: 6,
			},
			{
				id: ids.conditionSkill,
				slug: "python-conditions",
				name: "Điều kiện",
				description: "Rẽ nhánh chương trình với if và else.",
				gradeLevel: 6,
			},
			{
				id: ids.loopSkill,
				slug: "python-loops",
				name: "Vòng lặp",
				description: "Lặp lại thao tác bằng for và while.",
				gradeLevel: 6,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(skillPrerequisite)
		.values([
			{ skillId: ids.conditionSkill, prerequisiteSkillId: ids.variableSkill },
			{ skillId: ids.loopSkill, prerequisiteSkillId: ids.conditionSkill },
		])
		.onConflictDoNothing();

	await db
		.insert(courseSkill)
		.values([
			{ courseId: ids.course, skillId: ids.variableSkill, sequence: 1 },
			{ courseId: ids.course, skillId: ids.conditionSkill, sequence: 2 },
			{ courseId: ids.course, skillId: ids.loopSkill, sequence: 3 },
		])
		.onConflictDoNothing();

	await db
		.insert(learningContent)
		.values([
			{
				id: ids.conditionContent,
				courseId: ids.course,
				kind: "lesson",
				title: "Ôn lại điều kiện if/else",
				createdBy: ids.admin,
			},
			{
				id: ids.loopContent,
				courseId: ids.course,
				kind: "quiz",
				title: "Kiểm tra kiến thức vòng lặp",
				createdBy: ids.admin,
			},
			{
				id: ids.advancedLoopContent,
				courseId: ids.course,
				kind: "practice",
				title: "Thử thách vòng lặp nâng cao",
				createdBy: ids.admin,
			},
		])
		.onConflictDoNothing();

	const publishedContent = [
		{
			id: ids.conditionVersion,
			contentId: ids.conditionContent,
			versionNumber: 1,
			status: "published" as const,
			body: { sections: [{ title: "Điều kiện", content: "Ôn lại if/else." }] },
			metadata: { gradeLevel: 6, difficulty: "easy", language: "vi" },
		},
		{
			id: ids.loopVersion,
			contentId: ids.loopContent,
			versionNumber: 1,
			status: "published" as const,
			body: { instructions: "Chọn đáp án đúng." },
			metadata: { gradeLevel: 6, difficulty: "medium", language: "vi" },
		},
		{
			id: ids.advancedLoopVersion,
			contentId: ids.advancedLoopContent,
			versionNumber: 1,
			status: "published" as const,
			body: { instructions: "Viết chương trình dùng vòng lặp lồng nhau." },
			metadata: { gradeLevel: 6, difficulty: "hard", language: "vi" },
		},
	];

	await db
		.insert(contentVersion)
		.values(
			publishedContent.map((content) => ({
				...content,
				createdBy: ids.admin,
				reviewedBy: ids.admin,
				reviewedAt: new Date(),
				publishedAt: new Date(),
			})),
		)
		.onConflictDoNothing();

	await db
		.insert(contentSkill)
		.values([
			{
				contentVersionId: ids.conditionVersion,
				skillId: ids.conditionSkill,
				coverage: "primary",
			},
			{
				contentVersionId: ids.loopVersion,
				skillId: ids.loopSkill,
				coverage: "assessment",
			},
			{
				contentVersionId: ids.advancedLoopVersion,
				skillId: ids.loopSkill,
				coverage: "primary",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(courseContent)
		.values([
			{ courseId: ids.course, contentId: ids.conditionContent, position: 1 },
			{ courseId: ids.course, contentId: ids.loopContent, position: 2 },
			{ courseId: ids.course, contentId: ids.advancedLoopContent, position: 3 },
		])
		.onConflictDoNothing();

	await db
		.insert(classroom)
		.values({
			id: ids.classroom,
			name: "Lớp 6A",
			courseId: ids.course,
			teacherId: ids.teacher,
		})
		.onConflictDoNothing();

	await db
		.insert(learnerProfile)
		.values([
			{
				userId: ids.learnerNeedsPrerequisite,
				gradeLevel: 6,
				proficiencyLevel: "beginner",
				learningGoal: "Hiểu điều kiện trước khi học vòng lặp",
			},
			{
				userId: ids.learnerReadyForAdvanced,
				gradeLevel: 6,
				proficiencyLevel: "advanced",
				learningGoal: "Thử sức với bài tập vòng lặp nâng cao",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(classroomEnrollment)
		.values([
			{ classroomId: ids.classroom, learnerId: ids.learnerNeedsPrerequisite },
			{ classroomId: ids.classroom, learnerId: ids.learnerReadyForAdvanced },
		])
		.onConflictDoNothing();

	await db
		.insert(assessmentItem)
		.values({
			id: ids.loopQuestion,
			contentVersionId: ids.loopVersion,
			ordinal: 1,
			prompt: "Vòng lặp for thường dùng khi nào?",
			itemType: "single_choice",
			explanation: "Dùng for khi biết số lần lặp hoặc cần duyệt một tập hợp.",
		})
		.onConflictDoNothing();

	await db
		.insert(assessmentOption)
		.values({
			id: ids.loopCorrectOption,
			assessmentItemId: ids.loopQuestion,
			ordinal: 1,
			text: "Khi cần lặp qua một tập hợp giá trị",
			isCorrect: true,
		})
		.onConflictDoNothing();

	await db
		.insert(learningAttempt)
		.values({
			id: ids.attempt,
			learnerId: ids.learnerNeedsPrerequisite,
			contentVersionId: ids.loopVersion,
			status: "completed",
			completedAt: new Date(),
			durationSeconds: 160,
			score: 0,
		})
		.onConflictDoNothing();

	await db
		.insert(attemptResponse)
		.values({
			id: ids.response,
			attemptId: ids.attempt,
			assessmentItemId: ids.loopQuestion,
			isCorrect: false,
			attemptNumber: 2,
			durationSeconds: 90,
			errorType: "prerequisite_gap",
		})
		.onConflictDoNothing();

	await db
		.insert(masteryEvidence)
		.values({
			id: ids.evidence,
			learnerId: ids.learnerNeedsPrerequisite,
			skillId: ids.conditionSkill,
			attemptResponseId: ids.response,
			signalType: "prerequisite_gap",
			value: 0,
			weight: 1,
			reason: "Sai câu hỏi vòng lặp vì chưa nắm điều kiện if/else.",
		})
		.onConflictDoNothing();

	await db
		.insert(learnerSkillMastery)
		.values([
			{
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.conditionSkill,
				score: 0.35,
				evidenceCount: 1,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.conditionSkill,
				score: 0.9,
				evidenceCount: 4,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.loopSkill,
				score: 0.85,
				evidenceCount: 5,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(recommendationRun)
		.values({
			id: ids.recommendationRun,
			learnerId: ids.learnerNeedsPrerequisite,
			inputSnapshot: { conditionMastery: 0.35, loopMastery: 0 },
			engineVersion: "seed-v1",
		})
		.onConflictDoNothing();

	await db
		.insert(recommendation)
		.values({
			id: ids.recommendation,
			runId: ids.recommendationRun,
			contentVersionId: ids.conditionVersion,
			targetSkillId: ids.conditionSkill,
			reasonVi:
				"Bạn cần củng cố điều kiện if/else trước khi tiếp tục với vòng lặp.",
			rank: 1,
		})
		.onConflictDoNothing();
}

try {
	await seed();
} finally {
	await db.$client.end();
}
