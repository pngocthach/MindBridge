import { db, skill, skillPrerequisite } from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

const SKILL_GRAPH_LOCK_ID = 47_470_047;

const skillIdInput = z.object({
	skillId: z.string().uuid(),
});

const skillValues = z.object({
	description: z.string().trim().min(1).max(5000),
	gradeLevel: z.number().int().min(1).max(12),
	masteryThreshold: z.number().min(0).max(1),
	name: z.string().trim().min(1).max(255),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"Slug must contain lowercase letters, numbers, and single hyphens only.",
		),
});

const updateSkillInput = skillValues
	.partial()
	.extend({ skillId: z.string().uuid() })
	.refine(
		(input) =>
			input.description !== undefined ||
			input.gradeLevel !== undefined ||
			input.masteryThreshold !== undefined ||
			input.name !== undefined ||
			input.slug !== undefined,
		{ message: "Provide at least one skill field to update." },
	);

const prerequisiteInput = z
	.object({
		prerequisiteSkillId: z.string().uuid(),
		skillId: z.string().uuid(),
	})
	.refine((input) => input.skillId !== input.prerequisiteSkillId, {
		message: "A skill cannot be its own prerequisite.",
		path: ["prerequisiteSkillId"],
	});

const skillFields = {
	createdAt: skill.createdAt,
	description: skill.description,
	gradeLevel: skill.gradeLevel,
	id: skill.id,
	masteryThreshold: skill.masteryThreshold,
	name: skill.name,
	slug: skill.slug,
	updatedAt: skill.updatedAt,
};

type PrerequisiteEdge = {
	prerequisiteSkillId: string;
	skillId: string;
};

const createsCycle = (
	edges: readonly PrerequisiteEdge[],
	skillId: string,
	prerequisiteSkillId: string,
): boolean => {
	const prerequisitesBySkill = new Map<string, string[]>();
	for (const edge of edges) {
		const prerequisites = prerequisitesBySkill.get(edge.skillId) ?? [];
		prerequisites.push(edge.prerequisiteSkillId);
		prerequisitesBySkill.set(edge.skillId, prerequisites);
	}

	const pending = [prerequisiteSkillId];
	const visited = new Set<string>();
	while (pending.length > 0) {
		const currentSkillId = pending.pop();
		if (!currentSkillId || visited.has(currentSkillId)) continue;
		if (currentSkillId === skillId) return true;
		visited.add(currentSkillId);
		pending.push(...(prerequisitesBySkill.get(currentSkillId) ?? []));
	}
	return false;
};

const throwDuplicateSlug = (error: unknown): never => {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	) {
		throw new ORPCError("CONFLICT", {
			message: "A skill with this slug already exists.",
		});
	}
	throw error;
};

export const skillRouter = {
	addPrerequisite: adminProcedure
		.input(prerequisiteInput)
		.handler(({ input }) =>
			db.transaction(async (transaction) => {
				await transaction.execute(
					sql`select pg_advisory_xact_lock(${SKILL_GRAPH_LOCK_ID})`,
				);

				const referencedSkills = await transaction
					.select({ id: skill.id })
					.from(skill)
					.where(inArray(skill.id, [input.skillId, input.prerequisiteSkillId]));
				if (referencedSkills.length !== 2) {
					throw new ORPCError("NOT_FOUND", {
						message: "Skill or prerequisite skill not found.",
					});
				}

				const edges = await transaction
					.select({
						prerequisiteSkillId: skillPrerequisite.prerequisiteSkillId,
						skillId: skillPrerequisite.skillId,
					})
					.from(skillPrerequisite);
				const edgeExists = edges.some(
					(edge) =>
						edge.skillId === input.skillId &&
						edge.prerequisiteSkillId === input.prerequisiteSkillId,
				);
				if (edgeExists) {
					throw new ORPCError("CONFLICT", {
						message: "This prerequisite relationship already exists.",
					});
				}
				if (createsCycle(edges, input.skillId, input.prerequisiteSkillId)) {
					throw new ORPCError("CONFLICT", {
						message:
							"This prerequisite would create a cycle in the skill graph.",
					});
				}

				const [createdEdge] = await transaction
					.insert(skillPrerequisite)
					.values(input)
					.returning();
				if (!createdEdge) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Prerequisite relationship could not be created.",
					});
				}
				return createdEdge;
			}),
		),
	create: adminProcedure.input(skillValues).handler(async ({ input }) => {
		try {
			const [createdSkill] = await db
				.insert(skill)
				.values(input)
				.returning(skillFields);
			if (!createdSkill) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Skill could not be created.",
				});
			}
			return createdSkill;
		} catch (error) {
			return throwDuplicateSlug(error);
		}
	}),
	delete: adminProcedure.input(skillIdInput).handler(async ({ input }) => {
		const [deletedSkill] = await db
			.delete(skill)
			.where(eq(skill.id, input.skillId))
			.returning({ id: skill.id });
		if (!deletedSkill) {
			throw new ORPCError("NOT_FOUND", { message: "Skill not found." });
		}
		return deletedSkill;
	}),
	get: adminProcedure.input(skillIdInput).handler(async ({ input }) => {
		const [selectedSkill] = await db
			.select(skillFields)
			.from(skill)
			.where(eq(skill.id, input.skillId))
			.limit(1);
		if (!selectedSkill) {
			throw new ORPCError("NOT_FOUND", { message: "Skill not found." });
		}

		const edges = await db
			.select({
				prerequisiteSkillId: skillPrerequisite.prerequisiteSkillId,
				skillId: skillPrerequisite.skillId,
			})
			.from(skillPrerequisite)
			.where(
				or(
					eq(skillPrerequisite.skillId, input.skillId),
					eq(skillPrerequisite.prerequisiteSkillId, input.skillId),
				),
			)
			.orderBy(
				asc(skillPrerequisite.skillId),
				asc(skillPrerequisite.prerequisiteSkillId),
			);
		return { ...selectedSkill, edges };
	}),
	list: adminProcedure.handler(async () => {
		const [skills, prerequisites] = await Promise.all([
			db
				.select(skillFields)
				.from(skill)
				.orderBy(asc(skill.gradeLevel), asc(skill.name)),
			db
				.select({
					createdAt: skillPrerequisite.createdAt,
					prerequisiteSkillId: skillPrerequisite.prerequisiteSkillId,
					skillId: skillPrerequisite.skillId,
				})
				.from(skillPrerequisite)
				.orderBy(
					asc(skillPrerequisite.skillId),
					asc(skillPrerequisite.prerequisiteSkillId),
				),
		]);
		return { prerequisites, skills };
	}),
	removePrerequisite: adminProcedure
		.input(prerequisiteInput)
		.handler(async ({ input }) => {
			const [deletedEdge] = await db
				.delete(skillPrerequisite)
				.where(
					and(
						eq(skillPrerequisite.skillId, input.skillId),
						eq(
							skillPrerequisite.prerequisiteSkillId,
							input.prerequisiteSkillId,
						),
					),
				)
				.returning();
			if (!deletedEdge) {
				throw new ORPCError("NOT_FOUND", {
					message: "Prerequisite relationship not found.",
				});
			}
			return deletedEdge;
		}),
	update: adminProcedure.input(updateSkillInput).handler(async ({ input }) => {
		const { skillId, ...values } = input;
		try {
			const [updatedSkill] = await db
				.update(skill)
				.set(values)
				.where(eq(skill.id, skillId))
				.returning(skillFields);
			if (!updatedSkill) {
				throw new ORPCError("NOT_FOUND", { message: "Skill not found." });
			}
			return updatedSkill;
		} catch (error) {
			return throwDuplicateSlug(error);
		}
	}),
};
