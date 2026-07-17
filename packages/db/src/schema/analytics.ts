import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contentVersion } from "./content";
import { classroom, classroomGroup, skill } from "./learning";

/**
 * Learner signals, mastery evidence, recommendations, and teacher actions.
 * See docs/technical/database-schema.md for the computation and visibility rules.
 */

export const attemptStatus = pgEnum("attempt_status", [
	"in_progress",
	"completed",
	"abandoned",
]);
export const assessmentItemType = pgEnum("assessment_item_type", [
	"single_choice",
	"multiple_choice",
	"short_answer",
]);
export const errorType = pgEnum("error_type", [
	"prerequisite_gap",
	"skill_misconception",
	"careless_error",
	"time_pressure",
	"unknown",
]);
export const masterySignalType = pgEnum("mastery_signal_type", [
	"correct_response",
	"incorrect_response",
	"prerequisite_gap",
	"completion",
]);
export const recommendationStatus = pgEnum("recommendation_status", [
	"active",
	"viewed",
	"accepted",
	"dismissed",
]);
export const feedbackType = pgEnum("feedback_type", [
	"recommendation",
	"assignment",
	"content",
]);

export const assessmentItem = pgTable(
	"assessment_item",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "cascade" }),
		ordinal: integer("ordinal").notNull(),
		prompt: text("prompt").notNull(),
		itemType: assessmentItemType("item_type").notNull(),
		explanation: text("explanation").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("assessment_item_ordinal_unique").on(
			table.contentVersionId,
			table.ordinal,
		),
		check("assessment_item_ordinal_positive", sql`${table.ordinal} > 0`),
	],
);

export const assessmentOption = pgTable(
	"assessment_option",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		assessmentItemId: uuid("assessment_item_id")
			.notNull()
			.references(() => assessmentItem.id, { onDelete: "cascade" }),
		ordinal: integer("ordinal").notNull(),
		text: text("text").notNull(),
		isCorrect: boolean("is_correct").default(false).notNull(),
	},
	(table) => [
		unique("assessment_option_ordinal_unique").on(
			table.assessmentItemId,
			table.ordinal,
		),
		check("assessment_option_ordinal_positive", sql`${table.ordinal} > 0`),
	],
);

export const learningAttempt = pgTable(
	"learning_attempt",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		learnerId: text("learner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "restrict" }),
		status: attemptStatus("status").default("in_progress").notNull(),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
		durationSeconds: integer("duration_seconds"),
		score: real("score"),
	},
	(table) => [
		index("learning_attempt_learner_completed_idx").on(
			table.learnerId,
			table.completedAt,
		),
		check(
			"learning_attempt_duration_nonnegative",
			sql`${table.durationSeconds} IS NULL OR ${table.durationSeconds} >= 0`,
		),
		check(
			"learning_attempt_score_range",
			sql`${table.score} IS NULL OR (${table.score} >= 0 AND ${table.score} <= 1)`,
		),
	],
);

export const attemptResponse = pgTable(
	"attempt_response",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		attemptId: uuid("attempt_id")
			.notNull()
			.references(() => learningAttempt.id, { onDelete: "cascade" }),
		assessmentItemId: uuid("assessment_item_id")
			.notNull()
			.references(() => assessmentItem.id, { onDelete: "restrict" }),
		selectedOptionId: uuid("selected_option_id").references(
			() => assessmentOption.id,
			{ onDelete: "restrict" },
		),
		isCorrect: boolean("is_correct").notNull(),
		attemptNumber: integer("attempt_number").default(1).notNull(),
		durationSeconds: integer("duration_seconds"),
		errorType: errorType("error_type").default("unknown").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("attempt_response_unique").on(
			table.attemptId,
			table.assessmentItemId,
		),
		check("attempt_response_number_positive", sql`${table.attemptNumber} > 0`),
		check(
			"attempt_response_duration_nonnegative",
			sql`${table.durationSeconds} IS NULL OR ${table.durationSeconds} >= 0`,
		),
	],
);

export const learnerSkillMastery = pgTable(
	"learner_skill_mastery",
	{
		learnerId: text("learner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		skillId: uuid("skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "cascade" }),
		score: real("score").notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique("learner_skill_mastery_unique").on(table.learnerId, table.skillId),
		index("learner_skill_mastery_skill_idx").on(table.skillId),
		check(
			"learner_skill_mastery_score_range",
			sql`${table.score} >= 0 AND ${table.score} <= 1`,
		),
		check(
			"learner_skill_mastery_evidence_nonnegative",
			sql`${table.evidenceCount} >= 0`,
		),
	],
);

export const masteryEvidence = pgTable(
	"mastery_evidence",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		learnerId: text("learner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		skillId: uuid("skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "cascade" }),
		attemptResponseId: uuid("attempt_response_id").references(
			() => attemptResponse.id,
			{ onDelete: "set null" },
		),
		signalType: masterySignalType("signal_type").notNull(),
		value: real("value").notNull(),
		weight: real("weight").notNull(),
		reason: text("reason").notNull(),
		recordedAt: timestamp("recorded_at").defaultNow().notNull(),
	},
	(table) => [
		index("mastery_evidence_learner_skill_recorded_idx").on(
			table.learnerId,
			table.skillId,
			table.recordedAt,
		),
	],
);

export const recommendationRun = pgTable(
	"recommendation_run",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		learnerId: text("learner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		inputSnapshot: jsonb("input_snapshot").notNull(),
		engineVersion: text("engine_version").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("recommendation_run_learner_idx").on(table.learnerId)],
);

export const recommendation = pgTable(
	"recommendation",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		runId: uuid("run_id")
			.notNull()
			.references(() => recommendationRun.id, { onDelete: "cascade" }),
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "restrict" }),
		targetSkillId: uuid("target_skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "restrict" }),
		blockingSkillId: uuid("blocking_skill_id").references(() => skill.id, {
			onDelete: "restrict",
		}),
		reasonVi: text("reason_vi").notNull(),
		rank: integer("rank").notNull(),
		status: recommendationStatus("status").default("active").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("recommendation_run_rank_unique").on(table.runId, table.rank),
		check("recommendation_rank_positive", sql`${table.rank} > 0`),
	],
);

export const contentAssignment = pgTable(
	"content_assignment",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		assignedBy: text("assigned_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "restrict" }),
		classroomId: uuid("classroom_id").references(() => classroom.id, {
			onDelete: "cascade",
		}),
		groupId: uuid("group_id").references(() => classroomGroup.id, {
			onDelete: "cascade",
		}),
		learnerId: text("learner_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		dueAt: timestamp("due_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("content_assignment_version_idx").on(table.contentVersionId),
		check(
			"content_assignment_single_target",
			sql`(CASE WHEN ${table.classroomId} IS NULL THEN 0 ELSE 1 END + CASE WHEN ${table.groupId} IS NULL THEN 0 ELSE 1 END + CASE WHEN ${table.learnerId} IS NULL THEN 0 ELSE 1 END) = 1`,
		),
	],
);

export const teacherFeedback = pgTable(
	"teacher_feedback",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: text("teacher_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		learnerId: text("learner_id").references(() => user.id, {
			onDelete: "set null",
		}),
		recommendationId: uuid("recommendation_id").references(
			() => recommendation.id,
			{ onDelete: "set null" },
		),
		assignmentId: uuid("assignment_id").references(() => contentAssignment.id, {
			onDelete: "set null",
		}),
		feedbackType: feedbackType("feedback_type").notNull(),
		note: text("note").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("teacher_feedback_teacher_idx").on(table.teacherId)],
);
