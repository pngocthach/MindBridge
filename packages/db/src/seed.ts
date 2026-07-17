import { fileURLToPath } from "node:url";

import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

import {
	account,
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

dotenv.config({
	path: fileURLToPath(new URL("../../../apps/server/.env", import.meta.url)),
});

const { db } = await import("./index");

const ids = {
	admin: "seed-admin",
	teacher: "seed-teacher",
	learnerNeedsPrerequisite: "seed-learner-prerequisite",
	learnerBuildingFluency: "seed-learner-intermediate",
	learnerReadyForAdvanced: "seed-learner-advanced",
	course: "00000000-0000-4000-8000-000000000001",
	variableSkill: "00000000-0000-4000-8000-000000000011",
	conditionSkill: "00000000-0000-4000-8000-000000000012",
	loopSkill: "00000000-0000-4000-8000-000000000013",
	operatorSkill: "00000000-0000-4000-8000-000000000014",
	functionSkill: "00000000-0000-4000-8000-000000000015",
	collectionSkill: "00000000-0000-4000-8000-000000000016",
	algorithmSkill: "00000000-0000-4000-8000-000000000017",
	conditionContent: "00000000-0000-4000-8000-000000000021",
	loopContent: "00000000-0000-4000-8000-000000000022",
	algorithmContent: "00000000-0000-4000-8000-000000000023",
	variableContent: "00000000-0000-4000-8000-000000000024",
	functionContent: "00000000-0000-4000-8000-000000000025",
	collectionContent: "00000000-0000-4000-8000-000000000026",
	conditionVersion: "00000000-0000-4000-8000-000000000031",
	loopVersion: "00000000-0000-4000-8000-000000000032",
	algorithmVersion: "00000000-0000-4000-8000-000000000033",
	variableVersion: "00000000-0000-4000-8000-000000000034",
	functionVersion: "00000000-0000-4000-8000-000000000035",
	collectionVersion: "00000000-0000-4000-8000-000000000036",
	classroom: "00000000-0000-4000-8000-000000000041",
	loopQuestion: "00000000-0000-4000-8000-000000000051",
	collectionQuestion: "00000000-0000-4000-8000-000000000052",
	loopCorrectOption: "00000000-0000-4000-8000-000000000061",
	loopIncorrectOption: "00000000-0000-4000-8000-000000000062",
	collectionCorrectOption: "00000000-0000-4000-8000-000000000063",
	collectionIncorrectOption: "00000000-0000-4000-8000-000000000064",
	beginnerAttempt: "00000000-0000-4000-8000-000000000071",
	intermediateAttempt: "00000000-0000-4000-8000-000000000072",
	advancedAttempt: "00000000-0000-4000-8000-000000000073",
	beginnerResponse: "00000000-0000-4000-8000-000000000081",
	beginnerConditionEvidence: "00000000-0000-4000-8000-000000000082",
	beginnerOperatorEvidence: "00000000-0000-4000-8000-000000000083",
	intermediateResponse: "00000000-0000-4000-8000-000000000084",
	intermediateCollectionEvidence: "00000000-0000-4000-8000-000000000085",
	intermediateFunctionEvidence: "00000000-0000-4000-8000-000000000086",
	advancedResponse: "00000000-0000-4000-8000-000000000087",
	advancedLoopEvidence: "00000000-0000-4000-8000-000000000088",
	advancedAlgorithmEvidence: "00000000-0000-4000-8000-000000000089",
	beginnerRecommendationRun: "00000000-0000-4000-8000-000000000091",
	intermediateRecommendationRun: "00000000-0000-4000-8000-000000000092",
	advancedRecommendationRun: "00000000-0000-4000-8000-000000000093",
	beginnerRecommendation: "00000000-0000-4000-8000-000000000101",
	intermediateRecommendation: "00000000-0000-4000-8000-000000000102",
	advancedRecommendation: "00000000-0000-4000-8000-000000000103",
} as const;

const publishedAt = new Date("2026-07-17T00:00:00.000Z");

// Shared password for every seed account so the whole team can sign in.
const SEED_PASSWORD = "MindBridge@123";

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
				id: ids.learnerBuildingFluency,
				name: "Chi Lê",
				email: "chi.seed@mindbridge.local",
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

	// Better-Auth verifies email/password sign-ins against the account table
	// (provider "credential"), not the user table. Give every seed user a
	// credential row hashed with Better-Auth's own default hash so they can sign
	// in with the shared password below.
	const seedUserIds = [
		ids.admin,
		ids.teacher,
		ids.learnerNeedsPrerequisite,
		ids.learnerBuildingFluency,
		ids.learnerReadyForAdvanced,
	];
	const seedAccounts = await Promise.all(
		seedUserIds.map(async (userId) => ({
			id: `seed-account-${userId}`,
			accountId: userId,
			providerId: "credential",
			userId,
			password: await hashPassword(SEED_PASSWORD),
		})),
	);
	await db.insert(account).values(seedAccounts).onConflictDoNothing();

	await db
		.insert(course)
		.values({
			id: ids.course,
			title: "Lập trình Python nền tảng",
			description:
				"Khóa học tiếng Việt giúp học sinh lớp 6 xây dựng tư duy lập trình từ dữ liệu đến thuật toán.",
			gradeLevel: 6,
			language: "vi",
			createdBy: ids.admin,
		})
		.onConflictDoNothing();

	await db
		.insert(skill)
		.values([
			{
				id: ids.variableSkill,
				slug: "python-variables",
				name: "Biến và kiểu dữ liệu",
				description: "Lưu, đọc và thay đổi dữ liệu bằng biến Python.",
				gradeLevel: 6,
				masteryThreshold: 0.7,
			},
			{
				id: ids.operatorSkill,
				slug: "python-operators",
				name: "Toán tử và biểu thức",
				description: "Kết hợp biến bằng toán tử số học và so sánh.",
				gradeLevel: 6,
				masteryThreshold: 0.7,
			},
			{
				id: ids.conditionSkill,
				slug: "python-conditions",
				name: "Câu lệnh điều kiện",
				description: "Rẽ nhánh chương trình bằng if, elif và else.",
				gradeLevel: 6,
				masteryThreshold: 0.75,
			},
			{
				id: ids.loopSkill,
				slug: "python-loops",
				name: "Vòng lặp",
				description: "Lặp lại thao tác bằng for và while.",
				gradeLevel: 6,
				masteryThreshold: 0.75,
			},
			{
				id: ids.functionSkill,
				slug: "python-functions",
				name: "Hàm",
				description: "Chia chương trình thành các hàm có tham số và kết quả.",
				gradeLevel: 6,
				masteryThreshold: 0.75,
			},
			{
				id: ids.collectionSkill,
				slug: "python-collections",
				name: "Danh sách",
				description: "Tổ chức và truy cập nhiều giá trị trong danh sách.",
				gradeLevel: 6,
				masteryThreshold: 0.7,
			},
			{
				id: ids.algorithmSkill,
				slug: "python-algorithmic-problem-solving",
				name: "Giải quyết bài toán bằng thuật toán",
				description:
					"Phân rã bài toán và phối hợp vòng lặp, hàm, danh sách thành thuật toán.",
				gradeLevel: 6,
				masteryThreshold: 0.8,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(skillPrerequisite)
		.values([
			{ skillId: ids.operatorSkill, prerequisiteSkillId: ids.variableSkill },
			{ skillId: ids.conditionSkill, prerequisiteSkillId: ids.operatorSkill },
			{ skillId: ids.loopSkill, prerequisiteSkillId: ids.conditionSkill },
			{ skillId: ids.functionSkill, prerequisiteSkillId: ids.variableSkill },
			{ skillId: ids.functionSkill, prerequisiteSkillId: ids.conditionSkill },
			{ skillId: ids.collectionSkill, prerequisiteSkillId: ids.variableSkill },
			{ skillId: ids.algorithmSkill, prerequisiteSkillId: ids.loopSkill },
			{ skillId: ids.algorithmSkill, prerequisiteSkillId: ids.functionSkill },
			{ skillId: ids.algorithmSkill, prerequisiteSkillId: ids.collectionSkill },
		])
		.onConflictDoNothing();

	await db
		.insert(courseSkill)
		.values([
			{ courseId: ids.course, skillId: ids.variableSkill, sequence: 1 },
			{ courseId: ids.course, skillId: ids.conditionSkill, sequence: 2 },
			{ courseId: ids.course, skillId: ids.loopSkill, sequence: 3 },
			{ courseId: ids.course, skillId: ids.operatorSkill, sequence: 4 },
			{ courseId: ids.course, skillId: ids.functionSkill, sequence: 5 },
			{ courseId: ids.course, skillId: ids.collectionSkill, sequence: 6 },
			{ courseId: ids.course, skillId: ids.algorithmSkill, sequence: 7 },
		])
		.onConflictDoNothing();

	await db
		.insert(learningContent)
		.values([
			{
				id: ids.conditionContent,
				courseId: ids.course,
				kind: "lesson",
				title: "Ra quyết định với if/elif/else",
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
				id: ids.algorithmContent,
				courseId: ids.course,
				kind: "practice",
				title: "Thử thách phân tích điểm số",
				createdBy: ids.admin,
			},
			{
				id: ids.variableContent,
				courseId: ids.course,
				kind: "lesson",
				title: "Biến, kiểu dữ liệu và biểu thức",
				createdBy: ids.admin,
			},
			{
				id: ids.functionContent,
				courseId: ids.course,
				kind: "lesson",
				title: "Xây dựng hàm tái sử dụng",
				createdBy: ids.admin,
			},
			{
				id: ids.collectionContent,
				courseId: ids.course,
				kind: "quiz",
				title: "Luyện tập danh sách Python",
				createdBy: ids.admin,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(contentVersion)
		.values(
			[
				{
					id: ids.conditionVersion,
					contentId: ids.conditionContent,
					versionNumber: 1,
					status: "published" as const,
					body: {
						sections: [
							{
								title: "Từ phép so sánh đến quyết định",
								content:
									"Dùng biểu thức Boolean trong if, elif và else để chọn nhánh xử lý phù hợp.",
							},
						],
					},
					metadata: {
						gradeLevel: 6,
						difficulty: "beginner",
						language: "vi",
						targetSkills: ["python-conditions"],
						durationMinutes: 20,
					},
				},
				{
					id: ids.loopVersion,
					contentId: ids.loopContent,
					versionNumber: 1,
					status: "published" as const,
					body: {
						instructions:
							"Chọn đáp án đúng và giải thích khi nào nên dùng vòng lặp for.",
					},
					metadata: {
						gradeLevel: 6,
						difficulty: "intermediate",
						language: "vi",
						targetSkills: ["python-loops"],
						durationMinutes: 10,
					},
				},
				{
					id: ids.algorithmVersion,
					contentId: ids.algorithmContent,
					versionNumber: 1,
					status: "published" as const,
					body: {
						instructions:
							"Viết chương trình dùng hàm và vòng lặp để tìm các điểm số trên trung bình trong một danh sách.",
						successCriteria: [
							"Tách phép tính trung bình thành hàm",
							"Duyệt toàn bộ danh sách",
							"Xử lý đúng danh sách rỗng",
						],
					},
					metadata: {
						gradeLevel: 6,
						difficulty: "advanced",
						language: "vi",
						targetSkills: [
							"python-algorithmic-problem-solving",
							"python-functions",
							"python-collections",
						],
						durationMinutes: 40,
					},
				},
				{
					id: ids.variableVersion,
					contentId: ids.variableContent,
					versionNumber: 1,
					status: "published" as const,
					body: {
						sections: [
							{
								title: "Dữ liệu trong chương trình",
								content:
									"Gán giá trị cho biến, nhận biết số và chuỗi, rồi tạo biểu thức từ các biến.",
							},
						],
					},
					metadata: {
						gradeLevel: 6,
						difficulty: "beginner",
						language: "vi",
						targetSkills: ["python-variables", "python-operators"],
						durationMinutes: 25,
					},
				},
				{
					id: ids.functionVersion,
					contentId: ids.functionContent,
					versionNumber: 1,
					status: "published" as const,
					body: {
						sections: [
							{
								title: "Đóng gói một nhiệm vụ",
								content:
									"Khai báo hàm, truyền tham số và trả về kết quả để tránh lặp mã nguồn.",
							},
						],
					},
					metadata: {
						gradeLevel: 6,
						difficulty: "intermediate",
						language: "vi",
						targetSkills: ["python-functions"],
						durationMinutes: 25,
					},
				},
				{
					id: ids.collectionVersion,
					contentId: ids.collectionContent,
					versionNumber: 1,
					status: "published" as const,
					body: {
						instructions:
							"Trả lời câu hỏi về chỉ số, độ dài và cách duyệt danh sách.",
					},
					metadata: {
						gradeLevel: 6,
						difficulty: "intermediate",
						language: "vi",
						targetSkills: ["python-collections", "python-loops"],
						durationMinutes: 12,
					},
				},
			].map((content) => ({
				...content,
				createdBy: ids.admin,
				reviewedBy: ids.admin,
				reviewedAt: publishedAt,
				publishedAt,
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
				contentVersionId: ids.conditionVersion,
				skillId: ids.operatorSkill,
				coverage: "supporting",
			},
			{
				contentVersionId: ids.loopVersion,
				skillId: ids.loopSkill,
				coverage: "assessment",
			},
			{
				contentVersionId: ids.algorithmVersion,
				skillId: ids.algorithmSkill,
				coverage: "primary",
			},
			{
				contentVersionId: ids.algorithmVersion,
				skillId: ids.functionSkill,
				coverage: "supporting",
			},
			{
				contentVersionId: ids.algorithmVersion,
				skillId: ids.collectionSkill,
				coverage: "supporting",
			},
			{
				contentVersionId: ids.variableVersion,
				skillId: ids.variableSkill,
				coverage: "primary",
			},
			{
				contentVersionId: ids.variableVersion,
				skillId: ids.operatorSkill,
				coverage: "supporting",
			},
			{
				contentVersionId: ids.functionVersion,
				skillId: ids.functionSkill,
				coverage: "primary",
			},
			{
				contentVersionId: ids.collectionVersion,
				skillId: ids.collectionSkill,
				coverage: "assessment",
			},
			{
				contentVersionId: ids.collectionVersion,
				skillId: ids.loopSkill,
				coverage: "supporting",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(courseContent)
		.values([
			{ courseId: ids.course, contentId: ids.conditionContent, position: 1 },
			{ courseId: ids.course, contentId: ids.loopContent, position: 2 },
			{ courseId: ids.course, contentId: ids.algorithmContent, position: 3 },
			{ courseId: ids.course, contentId: ids.variableContent, position: 4 },
			{ courseId: ids.course, contentId: ids.functionContent, position: 5 },
			{ courseId: ids.course, contentId: ids.collectionContent, position: 6 },
		])
		.onConflictDoNothing();

	await db
		.insert(classroom)
		.values({
			id: ids.classroom,
			name: "Lớp 6A - Python",
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
				learningGoal:
					"Củng cố toán tử so sánh trước khi học lại điều kiện và vòng lặp.",
			},
			{
				userId: ids.learnerBuildingFluency,
				gradeLevel: 6,
				proficiencyLevel: "intermediate",
				learningGoal: "Luyện hàm và danh sách để giải bài toán hoàn chỉnh.",
			},
			{
				userId: ids.learnerReadyForAdvanced,
				gradeLevel: 6,
				proficiencyLevel: "advanced",
				learningGoal: "Vận dụng các kiến thức nền vào bài toán thuật toán.",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(classroomEnrollment)
		.values([
			{ classroomId: ids.classroom, learnerId: ids.learnerNeedsPrerequisite },
			{ classroomId: ids.classroom, learnerId: ids.learnerBuildingFluency },
			{ classroomId: ids.classroom, learnerId: ids.learnerReadyForAdvanced },
		])
		.onConflictDoNothing();

	await db
		.insert(assessmentItem)
		.values([
			{
				id: ids.loopQuestion,
				contentVersionId: ids.loopVersion,
				ordinal: 1,
				prompt: "Vòng lặp for thường phù hợp nhất trong trường hợp nào?",
				itemType: "single_choice",
				explanation:
					"Dùng for khi cần duyệt lần lượt các giá trị của một tập hợp.",
			},
			{
				id: ids.collectionQuestion,
				contentVersionId: ids.collectionVersion,
				ordinal: 1,
				prompt:
					"Chỉ số của phần tử đầu tiên trong danh sách Python là bao nhiêu?",
				itemType: "single_choice",
				explanation: "Danh sách Python đánh chỉ số từ 0.",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(assessmentOption)
		.values([
			{
				id: ids.loopCorrectOption,
				assessmentItemId: ids.loopQuestion,
				ordinal: 1,
				text: "Khi cần duyệt một tập hợp giá trị",
				isCorrect: true,
			},
			{
				id: ids.loopIncorrectOption,
				assessmentItemId: ids.loopQuestion,
				ordinal: 2,
				text: "Khi chương trình chỉ thực hiện một phép gán",
				isCorrect: false,
			},
			{
				id: ids.collectionCorrectOption,
				assessmentItemId: ids.collectionQuestion,
				ordinal: 1,
				text: "0",
				isCorrect: true,
			},
			{
				id: ids.collectionIncorrectOption,
				assessmentItemId: ids.collectionQuestion,
				ordinal: 2,
				text: "1",
				isCorrect: false,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(learningAttempt)
		.values([
			{
				id: ids.beginnerAttempt,
				learnerId: ids.learnerNeedsPrerequisite,
				contentVersionId: ids.loopVersion,
				status: "completed",
				completedAt: publishedAt,
				durationSeconds: 160,
				score: 0,
			},
			{
				id: ids.intermediateAttempt,
				learnerId: ids.learnerBuildingFluency,
				contentVersionId: ids.collectionVersion,
				status: "completed",
				completedAt: publishedAt,
				durationSeconds: 95,
				score: 0.55,
			},
			{
				id: ids.advancedAttempt,
				learnerId: ids.learnerReadyForAdvanced,
				contentVersionId: ids.loopVersion,
				status: "completed",
				completedAt: publishedAt,
				durationSeconds: 42,
				score: 1,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(attemptResponse)
		.values([
			{
				id: ids.beginnerResponse,
				attemptId: ids.beginnerAttempt,
				assessmentItemId: ids.loopQuestion,
				selectedOptionId: ids.loopIncorrectOption,
				isCorrect: false,
				attemptNumber: 2,
				durationSeconds: 90,
				errorType: "prerequisite_gap",
			},
			{
				id: ids.intermediateResponse,
				attemptId: ids.intermediateAttempt,
				assessmentItemId: ids.collectionQuestion,
				selectedOptionId: ids.collectionIncorrectOption,
				isCorrect: false,
				attemptNumber: 1,
				durationSeconds: 48,
				errorType: "skill_misconception",
			},
			{
				id: ids.advancedResponse,
				attemptId: ids.advancedAttempt,
				assessmentItemId: ids.loopQuestion,
				selectedOptionId: ids.loopCorrectOption,
				isCorrect: true,
				attemptNumber: 1,
				durationSeconds: 18,
				errorType: "unknown",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(masteryEvidence)
		.values([
			{
				id: ids.beginnerConditionEvidence,
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.conditionSkill,
				attemptResponseId: ids.beginnerResponse,
				signalType: "prerequisite_gap",
				value: 0.3,
				weight: 1,
				reason:
					"Câu trả lời cho thấy học viên chưa xác định đúng điều kiện điều khiển vòng lặp.",
			},
			{
				id: ids.beginnerOperatorEvidence,
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.operatorSkill,
				attemptResponseId: ids.beginnerResponse,
				signalType: "prerequisite_gap",
				value: 0.42,
				weight: 1,
				reason:
					"Học viên nhầm biểu thức so sánh, là tiền đề trực tiếp của câu lệnh điều kiện.",
			},
			{
				id: ids.intermediateCollectionEvidence,
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.collectionSkill,
				attemptResponseId: ids.intermediateResponse,
				signalType: "incorrect_response",
				value: 0.64,
				weight: 0.8,
				reason: "Học viên còn nhầm chỉ số bắt đầu của danh sách.",
			},
			{
				id: ids.intermediateFunctionEvidence,
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.functionSkill,
				signalType: "completion",
				value: 0.58,
				weight: 0.6,
				reason:
					"Đã hoàn thành bài nhập môn nhưng chưa đạt ngưỡng vận dụng hàm.",
			},
			{
				id: ids.advancedLoopEvidence,
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.loopSkill,
				attemptResponseId: ids.advancedResponse,
				signalType: "correct_response",
				value: 1,
				weight: 1,
				reason: "Trả lời nhanh và chính xác câu hỏi về cách dùng vòng lặp.",
			},
			{
				id: ids.advancedAlgorithmEvidence,
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.algorithmSkill,
				signalType: "completion",
				value: 0.62,
				weight: 0.5,
				reason:
					"Đã làm quen bài toán tổng hợp nhưng cần thêm thực hành để đạt ngưỡng 0.8.",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(learnerSkillMastery)
		.values([
			{
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.variableSkill,
				score: 0.82,
				evidenceCount: 3,
			},
			{
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.operatorSkill,
				score: 0.42,
				evidenceCount: 2,
			},
			{
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.conditionSkill,
				score: 0.3,
				evidenceCount: 2,
			},
			{
				learnerId: ids.learnerNeedsPrerequisite,
				skillId: ids.loopSkill,
				score: 0.15,
				evidenceCount: 1,
			},
			{
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.variableSkill,
				score: 0.9,
				evidenceCount: 5,
			},
			{
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.operatorSkill,
				score: 0.85,
				evidenceCount: 4,
			},
			{
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.conditionSkill,
				score: 0.8,
				evidenceCount: 4,
			},
			{
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.loopSkill,
				score: 0.78,
				evidenceCount: 4,
			},
			{
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.functionSkill,
				score: 0.58,
				evidenceCount: 2,
			},
			{
				learnerId: ids.learnerBuildingFluency,
				skillId: ids.collectionSkill,
				score: 0.64,
				evidenceCount: 3,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.variableSkill,
				score: 0.96,
				evidenceCount: 8,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.operatorSkill,
				score: 0.94,
				evidenceCount: 7,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.conditionSkill,
				score: 0.92,
				evidenceCount: 7,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.loopSkill,
				score: 0.93,
				evidenceCount: 8,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.functionSkill,
				score: 0.88,
				evidenceCount: 6,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.collectionSkill,
				score: 0.9,
				evidenceCount: 6,
			},
			{
				learnerId: ids.learnerReadyForAdvanced,
				skillId: ids.algorithmSkill,
				score: 0.62,
				evidenceCount: 2,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(recommendationRun)
		.values([
			{
				id: ids.beginnerRecommendationRun,
				learnerId: ids.learnerNeedsPrerequisite,
				inputSnapshot: {
					targetSkill: "python-conditions",
					mastery: { variables: 0.82, operators: 0.42, conditions: 0.3 },
					masteryThreshold: 0.75,
					weakPrerequisite: "python-operators",
				},
				engineVersion: "seed-skill-graph-v2",
			},
			{
				id: ids.intermediateRecommendationRun,
				learnerId: ids.learnerBuildingFluency,
				inputSnapshot: {
					targetSkill: "python-algorithmic-problem-solving",
					mastery: { functions: 0.58, collections: 0.64, loops: 0.78 },
					masteryThreshold: 0.8,
					weakPrerequisites: ["python-functions", "python-collections"],
				},
				engineVersion: "seed-skill-graph-v2",
			},
			{
				id: ids.advancedRecommendationRun,
				learnerId: ids.learnerReadyForAdvanced,
				inputSnapshot: {
					targetSkill: "python-algorithmic-problem-solving",
					mastery: { functions: 0.88, collections: 0.9, loops: 0.93 },
					masteryThreshold: 0.8,
					prerequisitesReady: true,
				},
				engineVersion: "seed-skill-graph-v2",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(recommendation)
		.values([
			{
				id: ids.beginnerRecommendation,
				runId: ids.beginnerRecommendationRun,
				contentVersionId: ids.variableVersion,
				targetSkillId: ids.operatorSkill,
				blockingSkillId: ids.operatorSkill,
				reasonVi:
					"Bạn cần củng cố toán tử so sánh trước khi học lại điều kiện và vòng lặp.",
				rank: 1,
			},
			{
				id: ids.intermediateRecommendation,
				runId: ids.intermediateRecommendationRun,
				contentVersionId: ids.functionVersion,
				targetSkillId: ids.functionSkill,
				blockingSkillId: ids.functionSkill,
				reasonVi:
					"Bạn đã vững vòng lặp nhưng cần luyện thêm hàm trước bài toán tổng hợp.",
				rank: 1,
			},
			{
				id: ids.advancedRecommendation,
				runId: ids.advancedRecommendationRun,
				contentVersionId: ids.algorithmVersion,
				targetSkillId: ids.algorithmSkill,
				reasonVi:
					"Bạn đã đạt ngưỡng của toàn bộ kiến thức tiền đề và sẵn sàng giải bài toán nâng cao.",
				rank: 1,
			},
		])
		.onConflictDoNothing();
}

try {
	await seed();
} finally {
	await db.$client.end();
}
