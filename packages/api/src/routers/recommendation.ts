import {
	contentSkill,
	contentVersion,
	db,
	learnerSkillMastery,
	learningAttempt,
	learningContent,
	recommendation,
	recommendationRun,
	skill,
	skillPrerequisite,
} from "@MindBridge/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const ENGINE_VERSION = "prerequisite-path-v2";

const generateInput = z.object({
	limit: z.number().int().min(1).max(20).default(6),
});

const difficultySchema = z
	.object({
		difficulty: z.string().optional(),
		gradeLevel: z.number().optional(),
	})
	.passthrough();

type Difficulty = "beginner" | "intermediate" | "advanced";

type SkillState = {
	gradeLevel: number;
	id: string;
	name: string;
	score: number;
	threshold: number;
};

type RecommendationPlan = {
	blockingSkill?: SkillState;
	priority: number;
	recommendedSkill: SkillState;
	targetSkill: SkillState;
};

type ContentCandidate = {
	contentVersionId: string;
	coverage: "primary" | "supporting" | "assessment";
	kind: "lesson" | "quiz" | "practice";
	metadata: unknown;
	skillId: string;
	title: string;
};

const normalizeDifficulty = (value: string | undefined): Difficulty | null => {
	switch (value?.toLowerCase()) {
		case "easy":
		case "beginner":
			return "beginner";
		case "medium":
		case "intermediate":
			return "intermediate";
		case "hard":
		case "advanced":
			return "advanced";
		default:
			return null;
	}
};

const difficultyForSkill = (skillState: SkillState): Difficulty => {
	const progressToThreshold = skillState.score / skillState.threshold;
	if (progressToThreshold < 0.5) {
		return "beginner";
	}
	if (progressToThreshold < 0.9) {
		return "intermediate";
	}
	return "advanced";
};

const difficultyRank: Record<Difficulty, number> = {
	advanced: 2,
	beginner: 0,
	intermediate: 1,
};

const coverageRank: Record<ContentCandidate["coverage"], number> = {
	assessment: 1,
	primary: 0,
	supporting: 2,
};

const metadataFor = (candidate: ContentCandidate) => {
	const parsed = difficultySchema.safeParse(candidate.metadata);
	return parsed.success ? parsed.data : {};
};

export const selectContent = (
	candidates: readonly ContentCandidate[],
	skillState: SkillState,
	usedContentIds: ReadonlySet<string>,
): ContentCandidate | undefined => {
	const desiredDifficulty = difficultyForSkill(skillState);
	const rankedCandidates = candidates
		.filter((candidate) => candidate.skillId === skillState.id)
		.map((candidate) => {
			const metadata = metadataFor(candidate);
			const difficulty = normalizeDifficulty(metadata.difficulty);
			return {
				candidate,
				difficultyDistance:
					difficulty === null
						? Number.POSITIVE_INFINITY
						: Math.abs(
								difficultyRank[difficulty] - difficultyRank[desiredDifficulty],
							),
				gradeMismatch:
					metadata.gradeLevel === undefined ||
					metadata.gradeLevel === skillState.gradeLevel
						? 0
						: 1,
			};
		})
		.sort((left, right) => {
			if (left.difficultyDistance !== right.difficultyDistance) {
				return left.difficultyDistance - right.difficultyDistance;
			}
			if (left.gradeMismatch !== right.gradeMismatch) {
				return left.gradeMismatch - right.gradeMismatch;
			}
			const coverageDifference =
				coverageRank[left.candidate.coverage] -
				coverageRank[right.candidate.coverage];
			if (coverageDifference !== 0) {
				return coverageDifference;
			}
			return left.candidate.contentVersionId.localeCompare(
				right.candidate.contentVersionId,
			);
		});

	return rankedCandidates.find(
		({ candidate }) => !usedContentIds.has(candidate.contentVersionId),
	)?.candidate;
};

const percent = (value: number): number => Math.round(value * 100);

const explainRecommendation = (plan: RecommendationPlan): string => {
	const targetStatus = `Kỹ năng "${plan.targetSkill.name}" đang ở mức ${percent(plan.targetSkill.score)}%, dưới ngưỡng ${percent(plan.targetSkill.threshold)}%.`;

	if (
		plan.blockingSkill &&
		plan.recommendedSkill.id === plan.blockingSkill.id
	) {
		return `${targetStatus} Trước tiên, bạn cần củng cố kiến thức tiền đề "${plan.blockingSkill.name}" đang ở mức ${percent(plan.blockingSkill.score)}%, dưới ngưỡng ${percent(plan.blockingSkill.threshold)}%.`;
	}

	if (plan.blockingSkill) {
		return `${targetStatus} Sau khi củng cố kiến thức tiền đề "${plan.blockingSkill.name}", nội dung này giúp bạn tiếp tục với kỹ năng đích.`;
	}

	return `${targetStatus} Các kiến thức tiền đề đã đạt yêu cầu, nên đây là bước học tiếp theo phù hợp.`;
};

export const buildPlans = (
	masteryRows: ReadonlyArray<{
		evidenceCount: number;
		score: number;
		skillId: string;
	}>,
	skills: readonly SkillState[],
	prerequisites: ReadonlyArray<{
		prerequisiteSkillId: string;
		skillId: string;
	}>,
): RecommendationPlan[] => {
	const skillById = new Map(
		skills.map((skillState) => [skillState.id, skillState]),
	);
	const masteryBySkill = new Map(
		masteryRows.map((mastery) => [mastery.skillId, mastery]),
	);
	const weakTargets = skills
		.map((skillState) => ({
			...skillState,
			score: masteryBySkill.get(skillState.id)?.score ?? skillState.score,
		}))
		.filter(
			(skillState) =>
				masteryBySkill.has(skillState.id) &&
				skillState.score < skillState.threshold,
		)
		.sort((left, right) => {
			const gapDifference =
				right.threshold - right.score - (left.threshold - left.score);
			return gapDifference || left.id.localeCompare(right.id);
		});

	const plans: RecommendationPlan[] = [];
	for (const targetSkill of weakTargets) {
		const missingPrerequisites = prerequisites
			.filter((edge) => edge.skillId === targetSkill.id)
			.map((edge) => skillById.get(edge.prerequisiteSkillId))
			.filter((prerequisite): prerequisite is SkillState => {
				if (!prerequisite) {
					return false;
				}
				const score = masteryBySkill.get(prerequisite.id)?.score ?? 0;
				return score < prerequisite.threshold;
			})
			.map((prerequisite) => ({
				...prerequisite,
				score: masteryBySkill.get(prerequisite.id)?.score ?? 0,
			}))
			.sort(
				(left, right) =>
					left.score - right.score || left.id.localeCompare(right.id),
			);

		for (const prerequisite of missingPrerequisites) {
			plans.push({
				blockingSkill: prerequisite,
				priority: 0,
				recommendedSkill: prerequisite,
				targetSkill,
			});
		}
		plans.push({
			blockingSkill: missingPrerequisites[0],
			priority: missingPrerequisites.length > 0 ? 2 : 1,
			recommendedSkill: targetSkill,
			targetSkill,
		});
	}

	plans.sort((left, right) => {
		if (left.priority !== right.priority) {
			return left.priority - right.priority;
		}
		const leftGap = left.targetSkill.threshold - left.targetSkill.score;
		const rightGap = right.targetSkill.threshold - right.targetSkill.score;
		return (
			rightGap - leftGap ||
			left.recommendedSkill.id.localeCompare(right.recommendedSkill.id)
		);
	});

	const plannedSkillIds = new Set<string>();
	return plans.filter((plan) => {
		if (plannedSkillIds.has(plan.recommendedSkill.id)) {
			return false;
		}
		plannedSkillIds.add(plan.recommendedSkill.id);
		return true;
	});
};

const getLatestRecommendations = async (learnerId: string) => {
	const [run] = await db
		.select()
		.from(recommendationRun)
		.where(eq(recommendationRun.learnerId, learnerId))
		.orderBy(desc(recommendationRun.createdAt), desc(recommendationRun.id))
		.limit(1);

	if (!run) {
		return { recommendations: [], run: null };
	}

	const recommendations = await db
		.select({
			blockingSkillId: recommendation.blockingSkillId,
			contentBody: contentVersion.body,
			contentKind: learningContent.kind,
			contentMetadata: contentVersion.metadata,
			contentTitle: learningContent.title,
			contentVersionId: recommendation.contentVersionId,
			id: recommendation.id,
			rank: recommendation.rank,
			reasonVi: recommendation.reasonVi,
			status: recommendation.status,
			targetSkillId: recommendation.targetSkillId,
			targetSkillName: skill.name,
		})
		.from(recommendation)
		.innerJoin(
			contentVersion,
			and(
				eq(contentVersion.id, recommendation.contentVersionId),
				eq(contentVersion.status, "published"),
			),
		)
		.innerJoin(
			learningContent,
			eq(learningContent.id, contentVersion.contentId),
		)
		.innerJoin(skill, eq(skill.id, recommendation.targetSkillId))
		.where(eq(recommendation.runId, run.id))
		.orderBy(asc(recommendation.rank));

	return { recommendations, run };
};

export const recommendationRouter = {
	generate: protectedProcedure
		.input(generateInput)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				const learnerId = context.session.user.id;
				const [previousRun] = await transaction
					.select({ id: recommendationRun.id })
					.from(recommendationRun)
					.where(eq(recommendationRun.learnerId, learnerId))
					.orderBy(
						desc(recommendationRun.createdAt),
						desc(recommendationRun.id),
					)
					.limit(1);
				const [completedContentRows, previousRecommendationRows] =
					await Promise.all([
						transaction
							.selectDistinct({
								contentVersionId: learningAttempt.contentVersionId,
							})
							.from(learningAttempt)
							.where(
								and(
									eq(learningAttempt.learnerId, learnerId),
									eq(learningAttempt.status, "completed"),
								),
							),
						previousRun
							? transaction
									.select({ contentVersionId: recommendation.contentVersionId })
									.from(recommendation)
									.where(eq(recommendation.runId, previousRun.id))
							: Promise.resolve([]),
					]);
				const [masteryRows, skillRows, prerequisiteRows, candidateRows] =
					await Promise.all([
						transaction
							.select({
								evidenceCount: learnerSkillMastery.evidenceCount,
								score: learnerSkillMastery.score,
								skillId: learnerSkillMastery.skillId,
							})
							.from(learnerSkillMastery)
							.where(eq(learnerSkillMastery.learnerId, learnerId))
							.orderBy(asc(learnerSkillMastery.skillId)),
						transaction
							.select({
								gradeLevel: skill.gradeLevel,
								id: skill.id,
								name: skill.name,
								threshold: skill.masteryThreshold,
							})
							.from(skill)
							.orderBy(asc(skill.id)),
						transaction
							.select({
								prerequisiteSkillId: skillPrerequisite.prerequisiteSkillId,
								skillId: skillPrerequisite.skillId,
							})
							.from(skillPrerequisite)
							.orderBy(
								asc(skillPrerequisite.skillId),
								asc(skillPrerequisite.prerequisiteSkillId),
							),
						transaction
							.select({
								contentVersionId: contentVersion.id,
								coverage: contentSkill.coverage,
								kind: learningContent.kind,
								metadata: contentVersion.metadata,
								skillId: contentSkill.skillId,
								title: learningContent.title,
							})
							.from(contentVersion)
							.innerJoin(
								contentSkill,
								eq(contentSkill.contentVersionId, contentVersion.id),
							)
							.innerJoin(
								learningContent,
								eq(learningContent.id, contentVersion.contentId),
							)
							.where(eq(contentVersion.status, "published"))
							.orderBy(asc(contentVersion.id), asc(contentSkill.skillId)),
					]);

				const skillStates: SkillState[] = skillRows.map((skillRow) => ({
					...skillRow,
					score:
						masteryRows.find((mastery) => mastery.skillId === skillRow.id)
							?.score ?? 0,
				}));
				const plans = buildPlans(masteryRows, skillStates, prerequisiteRows);
				const selectForPlans = (excludedContentIds: ReadonlySet<string>) => {
					const usedContentIds = new Set(excludedContentIds);
					const selections: Array<{
						candidate: ContentCandidate;
						plan: RecommendationPlan;
					}> = [];
					for (const plan of plans) {
						const candidate = selectContent(
							candidateRows,
							plan.recommendedSkill,
							usedContentIds,
						);
						if (candidate) {
							usedContentIds.add(candidate.contentVersionId);
							selections.push({ candidate, plan });
						}
						if (selections.length >= input.limit) {
							break;
						}
					}
					return selections;
				};
				const completedContentIds = new Set(
					completedContentRows.map((row) => row.contentVersionId),
				);
				const recentlyUsedContentIds = new Set([
					...completedContentIds,
					...previousRecommendationRows.map((row) => row.contentVersionId),
				]);
				const freshSelections = selectForPlans(recentlyUsedContentIds);
				const selections =
					freshSelections.length > 0
						? freshSelections
						: selectForPlans(completedContentIds);

				const [run] = await transaction
					.insert(recommendationRun)
					.values({
						engineVersion: ENGINE_VERSION,
						inputSnapshot: {
							mastery: masteryRows,
							plans: plans.map((plan) => ({
								blockingSkillId: plan.blockingSkill?.id,
								recommendedSkillId: plan.recommendedSkill.id,
								targetSkillId: plan.targetSkill.id,
							})),
							prerequisites: prerequisiteRows,
						},
						learnerId,
					})
					.returning();

				if (!run) {
					return { recommendations: [], run: null };
				}

				if (selections.length === 0) {
					return { recommendations: [], run };
				}

				const insertedRecommendations = await transaction
					.insert(recommendation)
					.values(
						selections.map(({ candidate, plan }, index) => ({
							blockingSkillId: plan.blockingSkill?.id,
							contentVersionId: candidate.contentVersionId,
							rank: index + 1,
							reasonVi: explainRecommendation(plan),
							runId: run.id,
							targetSkillId: plan.recommendedSkill.id,
						})),
					)
					.returning();

				return {
					recommendations: insertedRecommendations.map(
						(insertedRecommendation, index) => ({
							...insertedRecommendation,
							contentKind: selections[index]?.candidate.kind,
							contentTitle: selections[index]?.candidate.title,
							targetSkillName: selections[index]?.plan.recommendedSkill.name,
						}),
					),
					run,
				};
			}),
		),
	latest: protectedProcedure.handler(({ context }) =>
		getLatestRecommendations(context.session.user.id),
	),
};
