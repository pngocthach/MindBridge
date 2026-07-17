import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { course, skill, skillCoverage } from "./learning";

/**
 * Versioned content and source-traceability schema.
 * See docs/technical/database-schema.md for lifecycle invariants.
 */

export const contentKind = pgEnum("content_kind", [
	"lesson",
	"quiz",
	"practice",
]);
export const contentStatus = pgEnum("content_status", [
	"draft",
	"in_review",
	"approved",
	"published",
	"archived",
]);
export const sourceType = pgEnum("source_type", ["upload", "paste"]);
export const extractionStatus = pgEnum("extraction_status", [
	"pending",
	"completed",
	"failed",
]);
export const generationStatus = pgEnum("generation_status", [
	"pending",
	"succeeded",
	"failed",
]);

export const learningContent = pgTable(
	"learning_content",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		kind: contentKind("kind").notNull(),
		title: text("title").notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("learning_content_course_idx").on(table.courseId)],
);

export const contentVersion = pgTable(
	"content_version",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => learningContent.id, { onDelete: "cascade" }),
		versionNumber: integer("version_number").notNull(),
		status: contentStatus("status").default("draft").notNull(),
		body: jsonb("body").notNull(),
		metadata: jsonb("metadata").notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		reviewedBy: text("reviewed_by").references(() => user.id, {
			onDelete: "restrict",
		}),
		reviewedAt: timestamp("reviewed_at"),
		publishedAt: timestamp("published_at"),
		archivedAt: timestamp("archived_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		unique("content_version_number_unique").on(
			table.contentId,
			table.versionNumber,
		),
		index("content_version_status_idx").on(table.status, table.contentId),
		check("content_version_number_positive", sql`${table.versionNumber} > 0`),
		check(
			"content_version_published_reviewed",
			sql`${table.status} <> 'published' OR (${table.reviewedBy} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL AND ${table.publishedAt} IS NOT NULL)`,
		),
	],
);

export const contentSkill = pgTable(
	"content_skill",
	{
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "cascade" }),
		skillId: uuid("skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "cascade" }),
		coverage: skillCoverage("coverage").notNull(),
	},
	(table) => [
		unique("content_skill_unique").on(table.contentVersionId, table.skillId),
		index("content_skill_skill_idx").on(table.skillId),
	],
);

export const courseContent = pgTable(
	"course_content",
	{
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => learningContent.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		isRequired: boolean("is_required").default(true).notNull(),
	},
	(table) => [
		unique("course_content_unique").on(table.courseId, table.contentId),
		unique("course_content_position_unique").on(table.courseId, table.position),
		check("course_content_position_positive", sql`${table.position} > 0`),
	],
);

export const contentReviewEvent = pgTable(
	"content_review_event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "cascade" }),
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		fromStatus: contentStatus("from_status").notNull(),
		toStatus: contentStatus("to_status").notNull(),
		note: text("note"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("content_review_event_version_idx").on(table.contentVersionId),
	],
);

export const sourceDocument = pgTable(
	"source_document",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		uploadedBy: text("uploaded_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		sourceType: sourceType("source_type").notNull(),
		fileName: text("file_name"),
		mimeType: text("mime_type"),
		storageKey: text("storage_key"),
		rawText: text("raw_text"),
		extractionStatus: extractionStatus("extraction_status")
			.default("pending")
			.notNull(),
		extractionError: text("extraction_error"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("source_document_uploaded_by_idx").on(table.uploadedBy)],
);

export const sourceChunk = pgTable(
	"source_chunk",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => sourceDocument.id, { onDelete: "cascade" }),
		ordinal: integer("ordinal").notNull(),
		text: text("text").notNull(),
		pageFrom: integer("page_from"),
		pageTo: integer("page_to"),
		charStart: integer("char_start").notNull(),
		charEnd: integer("char_end").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("source_chunk_ordinal_unique").on(table.documentId, table.ordinal),
		check("source_chunk_ordinal_positive", sql`${table.ordinal} > 0`),
		check(
			"source_chunk_character_range",
			sql`${table.charStart} <= ${table.charEnd}`,
		),
	],
);

export const contentGeneration = pgTable(
	"content_generation",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		contentVersionId: uuid("content_version_id").references(
			() => contentVersion.id,
			{
				onDelete: "set null",
			},
		),
		requestedBy: text("requested_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		model: text("model").notNull(),
		promptVersion: text("prompt_version").notNull(),
		inputSnapshot: jsonb("input_snapshot").notNull(),
		outputSnapshot: jsonb("output_snapshot"),
		status: generationStatus("status").default("pending").notNull(),
		error: text("error"),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		index("content_generation_version_idx").on(table.contentVersionId),
	],
);

export const contentSourceReference = pgTable(
	"content_source_reference",
	{
		contentVersionId: uuid("content_version_id")
			.notNull()
			.references(() => contentVersion.id, { onDelete: "cascade" }),
		sourceChunkId: uuid("source_chunk_id")
			.notNull()
			.references(() => sourceChunk.id, { onDelete: "cascade" }),
		referenceKind: text("reference_kind").notNull(),
	},
	(table) => [
		unique("content_source_reference_unique").on(
			table.contentVersionId,
			table.sourceChunkId,
			table.referenceKind,
		),
	],
);
