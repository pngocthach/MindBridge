import {
	assessmentItem,
	assessmentOption,
	attemptResponse,
	contentSkill,
	contentVersion,
	db,
	learnerSkillMastery,
	learningAttempt,
	learningContent,
	masteryEvidence,
	skill,
	skillPrerequisite,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure, protectedProcedure } from "../index";

const responseInput = z.object({
	assessmentItemId: z.string().uuid(),
	attemptNumber: z.number().int().positive(),
	durationSeconds: z.number().int().nonnegative().optional(),
	selectedOptionId: z.string().uuid(),
});

const submitAttemptInput = z
	.object({
		contentVersionId: z.string().uuid(),
		durationSeconds: z.number().int().nonnegative().optional(),
		responses: z.array(responseInput).min(1).max(100),
		startedAt: z.coerce.date().optional(),
	})
	.refine(
		(input) =>
			new Set(input.responses.map((response) => response.assessmentItemId))
				.size === input.responses.length,
		{ message: "Each assessment item can only have one response." },
	);

type EvidenceValue = {
	attemptResponseId: string;
	learnerId: string;
	reason: string;
	signalType: "correct_response" | "incorrect_response" | "prerequisite_gap";
	skillId: string;
	value: number;
	weight: number;
};

const roundMastery = (value: number): number =>
	Math.round(value * 10_000) / 10_000;

const calculateMastery = (
	evidence: ReadonlyArray<{ value: number; weight: number }>,
): number => {
	let weightedValue = 0;
	let totalWeight = 0;

	for (const signal of evidence) {
		weightedValue += signal.value * signal.weight;
		totalWeight += signal.weight;
	}

	return totalWeight === 0 ? 0 : roundMastery(weightedValue / totalWeight);
};

const evidenceWeight = (attemptNumber: number): number =>
	roundMastery(Math.min(2, 1 + (attemptNumber - 1) * 0.25));

export const masteryRouter = {
	quiz: protectedProcedure
		.input(z.object({ contentVersionId: z.string().uuid() }))
		.handler(async ({ input }) => {
			const [version] = await db
				.select({ id: contentVersion.id })
				.from(contentVersion)
				.where(
					and(
						eq(contentVersion.id, input.contentVersionId),
						eq(contentVersion.status, "published"),
					),
				)
				.limit(1);
			if (!version) {
				throw new ORPCError("NOT_FOUND", {
					message: "Không tìm thấy bài kiểm tra đã xuất bản.",
				});
			}

			const items = await db
				.select({
					id: assessmentItem.id,
					itemType: assessmentItem.itemType,
					ordinal: assessmentItem.ordinal,
					prompt: assessmentItem.prompt,
				})
				.from(assessmentItem)
				.where(eq(assessmentItem.contentVersionId, input.contentVersionId))
				.orderBy(asc(assessmentItem.ordinal));
			if (items.length === 0) {
				return { contentVersionId: input.contentVersionId, items: [] };
			}

			const options = await db
				.select({
					assessmentItemId: assessmentOption.assessmentItemId,
					id: assessmentOption.id,
					ordinal: assessmentOption.ordinal,
					text: assessmentOption.text,
				})
				.from(assessmentOption)
				.where(
					inArray(
						assessmentOption.assessmentItemId,
						items.map((item) => item.id),
					),
				)
				.orderBy(asc(assessmentOption.ordinal));

			return {
				contentVersionId: input.contentVersionId,
				items: items.map((item) => ({
					...item,
					options: options
						.filter((option) => option.assessmentItemId === item.id)
						.map(({ id, text }) => ({ id, text })),
				})),
			};
		}),
	practice: protectedProcedure
		.input(
			z.object({ contentVersionId: z.string().uuid().optional() }).optional(),
		)
		.handler(async ({ input }) => {
			const requestedContentVersionId = input?.contentVersionId;
			const [item] = await db
				.select({
					contentTitle: learningContent.title,
					contentVersionId: contentVersion.id,
					explanation: assessmentItem.explanation,
					id: assessmentItem.id,
					prompt: assessmentItem.prompt,
				})
				.from(assessmentItem)
				.innerJoin(
					contentVersion,
					and(
						eq(contentVersion.id, assessmentItem.contentVersionId),
						eq(contentVersion.status, "published"),
						requestedContentVersionId
							? eq(contentVersion.id, requestedContentVersionId)
							: undefined,
					),
				)
				.innerJoin(
					learningContent,
					eq(learningContent.id, contentVersion.contentId),
				)
				.orderBy(asc(learningContent.title), asc(assessmentItem.ordinal))
				.limit(1);

			if (!item) {
				return null;
			}

			const options = await db
				.select({ id: assessmentOption.id, text: assessmentOption.text })
				.from(assessmentOption)
				.where(eq(assessmentOption.assessmentItemId, item.id))
				.orderBy(asc(assessmentOption.ordinal));

			return { ...item, options };
		}),
	profile: protectedProcedure.handler(async ({ context }) => {
		const learnerId = context.session.user.id;
		const [masteryRows, evidenceRows] = await Promise.all([
			db
				.select({
					evidenceCount: learnerSkillMastery.evidenceCount,
					masteryThreshold: skill.masteryThreshold,
					score: learnerSkillMastery.score,
					skillDescription: skill.description,
					skillId: skill.id,
					skillName: skill.name,
					skillSlug: skill.slug,
					updatedAt: learnerSkillMastery.updatedAt,
				})
				.from(learnerSkillMastery)
				.innerJoin(skill, eq(skill.id, learnerSkillMastery.skillId))
				.where(eq(learnerSkillMastery.learnerId, learnerId))
				.orderBy(asc(skill.name), asc(skill.id)),
			db
				.select({
					attemptResponseId: masteryEvidence.attemptResponseId,
					id: masteryEvidence.id,
					reason: masteryEvidence.reason,
					recordedAt: masteryEvidence.recordedAt,
					signalType: masteryEvidence.signalType,
					skillId: masteryEvidence.skillId,
					value: masteryEvidence.value,
					weight: masteryEvidence.weight,
				})
				.from(masteryEvidence)
				.where(eq(masteryEvidence.learnerId, learnerId))
				.orderBy(
					asc(masteryEvidence.skillId),
					asc(masteryEvidence.recordedAt),
					asc(masteryEvidence.id),
				),
		]);

		const evidenceBySkill = new Map<
			string,
			Array<(typeof evidenceRows)[number]>
		>();
		for (const evidence of evidenceRows) {
			const skillEvidence = evidenceBySkill.get(evidence.skillId) ?? [];
			skillEvidence.push(evidence);
			evidenceBySkill.set(evidence.skillId, skillEvidence);
		}

		return {
			learnerId,
			skills: masteryRows.map((mastery) => ({
				...mastery,
				evidence: evidenceBySkill.get(mastery.skillId) ?? [],
				isMastered: mastery.score >= mastery.masteryThreshold,
			})),
		};
	}),
	submitAttempt: permissionProcedure("learning:attempt")
		.input(submitAttemptInput)
		.handler(({ context, input }) =>
			db.transaction(async (transaction) => {
				const learnerId = context.session.user.id;
				const sortedResponses = [...input.responses].sort((left, right) =>
					left.assessmentItemId.localeCompare(right.assessmentItemId),
				);
				const assessmentItemIds = sortedResponses.map(
					(response) => response.assessmentItemId,
				);
				const items = await transaction
					.select({ id: assessmentItem.id })
					.from(assessmentItem)
					.where(
						and(
							eq(assessmentItem.contentVersionId, input.contentVersionId),
							inArray(assessmentItem.id, assessmentItemIds),
						),
					);

				if (items.length !== assessmentItemIds.length) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Every assessment item must belong to the submitted content version.",
					});
				}

				const selectedOptionIds = sortedResponses.map(
					(response) => response.selectedOptionId,
				);
				const options = await transaction
					.select({
						assessmentItemId: assessmentOption.assessmentItemId,
						id: assessmentOption.id,
						isCorrect: assessmentOption.isCorrect,
					})
					.from(assessmentOption)
					.where(inArray(assessmentOption.id, selectedOptionIds));
				const optionsById = new Map(
					options.map((option) => [option.id, option]),
				);
				const evaluatedResponses = sortedResponses.map((response) => {
					const option = optionsById.get(response.selectedOptionId);
					if (
						!option ||
						option.assessmentItemId !== response.assessmentItemId
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"A selected option is invalid or does not match its assessment item.",
						});
					}
					return {
						...response,
						isCorrect: option.isCorrect,
					};
				});

				const skillMappings = await transaction
					.select({
						coverage: contentSkill.coverage,
						skillId: contentSkill.skillId,
					})
					.from(contentSkill)
					.where(eq(contentSkill.contentVersionId, input.contentVersionId));
				const primarySkillIds = skillMappings
					.filter((mapping) => mapping.coverage !== "supporting")
					.map((mapping) => mapping.skillId)
					.sort();

				if (primarySkillIds.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Content version has no assessable skill coverage.",
					});
				}

				const prerequisiteRows = await transaction
					.select({
						prerequisiteSkillId: skillPrerequisite.prerequisiteSkillId,
						skillId: skillPrerequisite.skillId,
					})
					.from(skillPrerequisite)
					.where(inArray(skillPrerequisite.skillId, primarySkillIds));
				const prerequisiteIds = [
					...new Set(prerequisiteRows.map((row) => row.prerequisiteSkillId)),
				].sort();
				const classifiedResponses = evaluatedResponses.map((response) => ({
					...response,
					errorType: response.isCorrect
						? ("unknown" as const)
						: prerequisiteIds.length > 0
							? ("prerequisite_gap" as const)
							: ("skill_misconception" as const),
				}));

				const correctResponseCount = classifiedResponses.filter(
					(response) => response.isCorrect,
				).length;
				const [attempt] = await transaction
					.insert(learningAttempt)
					.values({
						completedAt: new Date(),
						contentVersionId: input.contentVersionId,
						durationSeconds: input.durationSeconds,
						learnerId,
						score: roundMastery(correctResponseCount / sortedResponses.length),
						startedAt: input.startedAt,
						status: "completed",
					})
					.returning();

				if (!attempt) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Could not create learning attempt.",
					});
				}

				const insertedResponses = await transaction
					.insert(attemptResponse)
					.values(
						classifiedResponses.map((response) => ({
							assessmentItemId: response.assessmentItemId,
							attemptId: attempt.id,
							attemptNumber: response.attemptNumber,
							durationSeconds: response.durationSeconds,
							errorType: response.errorType,
							isCorrect: response.isCorrect,
							selectedOptionId: response.selectedOptionId,
						})),
					)
					.returning({
						assessmentItemId: attemptResponse.assessmentItemId,
						id: attemptResponse.id,
					});
				const insertedResponseByItem = new Map(
					insertedResponses.map((response) => [
						response.assessmentItemId,
						response.id,
					]),
				);

				const evidenceValues: EvidenceValue[] = [];
				for (const response of classifiedResponses) {
					const responseId = insertedResponseByItem.get(
						response.assessmentItemId,
					);
					if (!responseId) {
						throw new ORPCError("INTERNAL_SERVER_ERROR", {
							message: "Could not persist an assessment response.",
						});
					}

					const targetsPrerequisite =
						!response.isCorrect &&
						response.errorType === "prerequisite_gap" &&
						prerequisiteIds.length > 0;
					const affectedSkillIds = targetsPrerequisite
						? prerequisiteIds
						: primarySkillIds;
					for (const skillId of affectedSkillIds) {
						evidenceValues.push({
							attemptResponseId: responseId,
							learnerId,
							reason: targetsPrerequisite
								? "Câu trả lời sai cho thấy lỗ hổng ở kiến thức tiền đề của kỹ năng đang học."
								: response.isCorrect
									? "Câu trả lời đúng cung cấp bằng chứng tích cực cho kỹ năng đang học."
									: `Câu trả lời sai được phân loại là ${response.errorType} ở kỹ năng đang học.`,
							signalType: targetsPrerequisite
								? "prerequisite_gap"
								: response.isCorrect
									? "correct_response"
									: "incorrect_response",
							skillId,
							value: response.isCorrect ? 1 : 0,
							weight: evidenceWeight(response.attemptNumber),
						});
					}
				}

				await transaction.insert(masteryEvidence).values(evidenceValues);

				const affectedSkillIds = [
					...new Set(evidenceValues.map((evidence) => evidence.skillId)),
				].sort();
				const masteryUpdates = [];
				for (const skillId of affectedSkillIds) {
					const skillEvidence = await transaction
						.select({
							id: masteryEvidence.id,
							value: masteryEvidence.value,
							weight: masteryEvidence.weight,
						})
						.from(masteryEvidence)
						.where(
							and(
								eq(masteryEvidence.learnerId, learnerId),
								eq(masteryEvidence.skillId, skillId),
							),
						)
						.orderBy(asc(masteryEvidence.id));
					const score = calculateMastery(skillEvidence);
					const [updatedMastery] = await transaction
						.insert(learnerSkillMastery)
						.values({
							evidenceCount: skillEvidence.length,
							learnerId,
							score,
							skillId,
							updatedAt: new Date(),
						})
						.onConflictDoUpdate({
							set: {
								evidenceCount: skillEvidence.length,
								score,
								updatedAt: new Date(),
							},
							target: [
								learnerSkillMastery.learnerId,
								learnerSkillMastery.skillId,
							],
						})
						.returning();

					if (updatedMastery) {
						masteryUpdates.push(updatedMastery);
					}
				}

				const correctOptions = await transaction
					.select({
						assessmentItemId: assessmentOption.assessmentItemId,
						id: assessmentOption.id,
					})
					.from(assessmentOption)
					.where(
						and(
							inArray(assessmentOption.assessmentItemId, assessmentItemIds),
							eq(assessmentOption.isCorrect, true),
						),
					);
				const correctOptionByItem = new Map(
					correctOptions.map((option) => [option.assessmentItemId, option.id]),
				);
				const results = classifiedResponses.map((response) => ({
					assessmentItemId: response.assessmentItemId,
					correctOptionId:
						correctOptionByItem.get(response.assessmentItemId) ?? null,
					isCorrect: response.isCorrect,
					selectedOptionId: response.selectedOptionId,
				}));

				return {
					attempt,
					evidence: evidenceValues,
					mastery: masteryUpdates,
					results,
				};
			}),
		),
};
