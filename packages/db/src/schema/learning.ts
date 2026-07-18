import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Core learning-domain schema. See docs/technical/database-schema.md.
 * Better Auth owns `user`; domain tables reference its text primary key.
 */

export const enrollmentStatus = pgEnum("enrollment_status", [
	"active",
	"completed",
	"withdrawn",
]);

export const skillCoverage = pgEnum("skill_coverage", [
	"primary",
	"supporting",
	"assessment",
]);

export const course = pgTable(
	"course",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		title: text("title").notNull(),
		description: text("description").notNull(),
		gradeLevel: integer("grade_level").notNull(),
		language: text("language").default("vi").notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		archivedAt: timestamp("archived_at"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("course_grade_level_idx").on(table.gradeLevel)],
);

export const skill = pgTable(
	"skill",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull(),
		gradeLevel: integer("grade_level").notNull(),
		masteryThreshold: real("mastery_threshold").default(0.7).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		unique("skill_slug_unique").on(table.slug),
		index("skill_grade_level_idx").on(table.gradeLevel),
		check(
			"skill_mastery_threshold_range",
			sql`${table.masteryThreshold} >= 0 AND ${table.masteryThreshold} <= 1`,
		),
	],
);

export const skillPrerequisite = pgTable(
	"skill_prerequisite",
	{
		skillId: uuid("skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "cascade" }),
		prerequisiteSkillId: uuid("prerequisite_skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("skill_prerequisite_unique").on(
			table.skillId,
			table.prerequisiteSkillId,
		),
		check(
			"skill_prerequisite_not_self",
			sql`${table.skillId} <> ${table.prerequisiteSkillId}`,
		),
	],
);

export const courseSkill = pgTable(
	"course_skill",
	{
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		skillId: uuid("skill_id")
			.notNull()
			.references(() => skill.id, { onDelete: "cascade" }),
		sequence: integer("sequence").notNull(),
	},
	(table) => [
		unique("course_skill_unique").on(table.courseId, table.skillId),
		unique("course_skill_sequence_unique").on(table.courseId, table.sequence),
		check("course_skill_sequence_positive", sql`${table.sequence} > 0`),
	],
);

export const learnerProfile = pgTable("learner_profile", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	gradeLevel: integer("grade_level"),
	proficiencyLevel: text("proficiency_level"),
	learningGoal: text("learning_goal"),
	locale: text("locale").default("vi-VN").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const classroom = pgTable(
	"classroom",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "restrict" }),
		teacherId: text("teacher_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("classroom_teacher_idx").on(table.teacherId)],
);

export const classroomEnrollment = pgTable(
	"classroom_enrollment",
	{
		classroomId: uuid("classroom_id")
			.notNull()
			.references(() => classroom.id, { onDelete: "cascade" }),
		learnerId: text("learner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: enrollmentStatus("status").default("active").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("classroom_enrollment_unique").on(
			table.classroomId,
			table.learnerId,
		),
		index("classroom_enrollment_learner_idx").on(table.learnerId),
	],
);

export const classroomGroup = pgTable(
	"classroom_group",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classroomId: uuid("classroom_id")
			.notNull()
			.references(() => classroom.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("classroom_group_name_unique").on(table.classroomId, table.name),
	],
);

export const classroomGroupMember = pgTable(
	"classroom_group_member",
	{
		groupId: uuid("group_id")
			.notNull()
			.references(() => classroomGroup.id, { onDelete: "cascade" }),
		learnerId: text("learner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("classroom_group_member_unique").on(table.groupId, table.learnerId),
	],
);
