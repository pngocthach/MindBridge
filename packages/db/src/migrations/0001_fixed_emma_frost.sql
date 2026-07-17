CREATE TYPE "public"."assessment_item_type" AS ENUM('single_choice', 'multiple_choice', 'short_answer');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."error_type" AS ENUM('prerequisite_gap', 'skill_misconception', 'careless_error', 'time_pressure', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('recommendation', 'assignment', 'content');--> statement-breakpoint
CREATE TYPE "public"."mastery_signal_type" AS ENUM('correct_response', 'incorrect_response', 'prerequisite_gap', 'completion');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('active', 'viewed', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."content_kind" AS ENUM('lesson', 'quiz', 'practice');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('upload', 'paste');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."skill_coverage" AS ENUM('primary', 'supporting', 'assessment');--> statement-breakpoint
CREATE TABLE "assessment_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_version_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"prompt" text NOT NULL,
	"item_type" "assessment_item_type" NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_item_ordinal_unique" UNIQUE("content_version_id","ordinal"),
	CONSTRAINT "assessment_item_ordinal_positive" CHECK ("assessment_item"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_item_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	CONSTRAINT "assessment_option_ordinal_unique" UNIQUE("assessment_item_id","ordinal"),
	CONSTRAINT "assessment_option_ordinal_positive" CHECK ("assessment_option"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "attempt_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"assessment_item_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"is_correct" boolean NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"duration_seconds" integer,
	"error_type" "error_type" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_response_unique" UNIQUE("attempt_id","assessment_item_id"),
	CONSTRAINT "attempt_response_number_positive" CHECK ("attempt_response"."attempt_number" > 0),
	CONSTRAINT "attempt_response_duration_nonnegative" CHECK ("attempt_response"."duration_seconds" IS NULL OR "attempt_response"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assigned_by" text NOT NULL,
	"content_version_id" uuid NOT NULL,
	"classroom_id" uuid,
	"group_id" uuid,
	"learner_id" text,
	"due_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_assignment_single_target" CHECK ((CASE WHEN "content_assignment"."classroom_id" IS NULL THEN 0 ELSE 1 END + CASE WHEN "content_assignment"."group_id" IS NULL THEN 0 ELSE 1 END + CASE WHEN "content_assignment"."learner_id" IS NULL THEN 0 ELSE 1 END) = 1)
);
--> statement-breakpoint
CREATE TABLE "learner_skill_mastery" (
	"learner_id" text NOT NULL,
	"skill_id" uuid NOT NULL,
	"score" real NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learner_skill_mastery_unique" UNIQUE("learner_id","skill_id"),
	CONSTRAINT "learner_skill_mastery_score_range" CHECK ("learner_skill_mastery"."score" >= 0 AND "learner_skill_mastery"."score" <= 1),
	CONSTRAINT "learner_skill_mastery_evidence_nonnegative" CHECK ("learner_skill_mastery"."evidence_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "learning_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" text NOT NULL,
	"content_version_id" uuid NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_seconds" integer,
	"score" real,
	CONSTRAINT "learning_attempt_duration_nonnegative" CHECK ("learning_attempt"."duration_seconds" IS NULL OR "learning_attempt"."duration_seconds" >= 0),
	CONSTRAINT "learning_attempt_score_range" CHECK ("learning_attempt"."score" IS NULL OR ("learning_attempt"."score" >= 0 AND "learning_attempt"."score" <= 1))
);
--> statement-breakpoint
CREATE TABLE "mastery_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" text NOT NULL,
	"skill_id" uuid NOT NULL,
	"attempt_response_id" uuid,
	"signal_type" "mastery_signal_type" NOT NULL,
	"value" real NOT NULL,
	"weight" real NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"content_version_id" uuid NOT NULL,
	"target_skill_id" uuid NOT NULL,
	"blocking_skill_id" uuid,
	"reason_vi" text NOT NULL,
	"rank" integer NOT NULL,
	"status" "recommendation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_run_rank_unique" UNIQUE("run_id","rank"),
	CONSTRAINT "recommendation_rank_positive" CHECK ("recommendation"."rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "recommendation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"learner_id" text,
	"recommendation_id" uuid,
	"assignment_id" uuid,
	"feedback_type" "feedback_type" NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_generation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_version_id" uuid,
	"requested_by" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"output_snapshot" jsonb,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "content_review_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_version_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"from_status" "content_status" NOT NULL,
	"to_status" "content_status" NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_skill" (
	"content_version_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"coverage" "skill_coverage" NOT NULL,
	CONSTRAINT "content_skill_unique" UNIQUE("content_version_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "content_source_reference" (
	"content_version_id" uuid NOT NULL,
	"source_chunk_id" uuid NOT NULL,
	"reference_kind" text NOT NULL,
	CONSTRAINT "content_source_reference_unique" UNIQUE("content_version_id","source_chunk_id","reference_kind")
);
--> statement-breakpoint
CREATE TABLE "content_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"body" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"published_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_version_number_unique" UNIQUE("content_id","version_number"),
	CONSTRAINT "content_version_number_positive" CHECK ("content_version"."version_number" > 0),
	CONSTRAINT "content_version_published_reviewed" CHECK ("content_version"."status" <> 'published' OR ("content_version"."reviewed_by" IS NOT NULL AND "content_version"."reviewed_at" IS NOT NULL AND "content_version"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "course_content" (
	"course_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "course_content_unique" UNIQUE("course_id","content_id"),
	CONSTRAINT "course_content_position_unique" UNIQUE("course_id","position"),
	CONSTRAINT "course_content_position_positive" CHECK ("course_content"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "learning_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"kind" "content_kind" NOT NULL,
	"title" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"page_from" integer,
	"page_to" integer,
	"char_start" integer NOT NULL,
	"char_end" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_chunk_ordinal_unique" UNIQUE("document_id","ordinal"),
	CONSTRAINT "source_chunk_ordinal_positive" CHECK ("source_chunk"."ordinal" > 0),
	CONSTRAINT "source_chunk_character_range" CHECK ("source_chunk"."char_start" <= "source_chunk"."char_end")
);
--> statement-breakpoint
CREATE TABLE "source_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"file_name" text,
	"mime_type" text,
	"storage_key" text,
	"raw_text" text,
	"extraction_status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"course_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_enrollment" (
	"classroom_id" uuid NOT NULL,
	"learner_id" text NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_enrollment_unique" UNIQUE("classroom_id","learner_id")
);
--> statement-breakpoint
CREATE TABLE "classroom_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classroom_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_group_name_unique" UNIQUE("classroom_id","name")
);
--> statement-breakpoint
CREATE TABLE "classroom_group_member" (
	"group_id" uuid NOT NULL,
	"learner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_group_member_unique" UNIQUE("group_id","learner_id")
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"grade_level" integer NOT NULL,
	"language" text DEFAULT 'vi' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_skill" (
	"course_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	CONSTRAINT "course_skill_unique" UNIQUE("course_id","skill_id"),
	CONSTRAINT "course_skill_sequence_unique" UNIQUE("course_id","sequence"),
	CONSTRAINT "course_skill_sequence_positive" CHECK ("course_skill"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "learner_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"grade_level" integer,
	"proficiency_level" text,
	"learning_goal" text,
	"locale" text DEFAULT 'vi-VN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"grade_level" integer NOT NULL,
	"mastery_threshold" real DEFAULT 0.7 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_slug_unique" UNIQUE("slug"),
	CONSTRAINT "skill_mastery_threshold_range" CHECK ("skill"."mastery_threshold" >= 0 AND "skill"."mastery_threshold" <= 1)
);
--> statement-breakpoint
CREATE TABLE "skill_prerequisite" (
	"skill_id" uuid NOT NULL,
	"prerequisite_skill_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_prerequisite_unique" UNIQUE("skill_id","prerequisite_skill_id"),
	CONSTRAINT "skill_prerequisite_not_self" CHECK ("skill_prerequisite"."skill_id" <> "skill_prerequisite"."prerequisite_skill_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_item" ADD CONSTRAINT "assessment_item_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_option" ADD CONSTRAINT "assessment_option_assessment_item_id_assessment_item_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_response" ADD CONSTRAINT "attempt_response_attempt_id_learning_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."learning_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_response" ADD CONSTRAINT "attempt_response_assessment_item_id_assessment_item_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_response" ADD CONSTRAINT "attempt_response_selected_option_id_assessment_option_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."assessment_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assignment" ADD CONSTRAINT "content_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assignment" ADD CONSTRAINT "content_assignment_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assignment" ADD CONSTRAINT "content_assignment_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assignment" ADD CONSTRAINT "content_assignment_group_id_classroom_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."classroom_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assignment" ADD CONSTRAINT "content_assignment_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_skill_mastery" ADD CONSTRAINT "learner_skill_mastery_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_skill_mastery" ADD CONSTRAINT "learner_skill_mastery_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_attempt" ADD CONSTRAINT "learning_attempt_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_attempt" ADD CONSTRAINT "learning_attempt_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_evidence" ADD CONSTRAINT "mastery_evidence_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_evidence" ADD CONSTRAINT "mastery_evidence_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_evidence" ADD CONSTRAINT "mastery_evidence_attempt_response_id_attempt_response_id_fk" FOREIGN KEY ("attempt_response_id") REFERENCES "public"."attempt_response"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_run_id_recommendation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recommendation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_target_skill_id_skill_id_fk" FOREIGN KEY ("target_skill_id") REFERENCES "public"."skill"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_blocking_skill_id_skill_id_fk" FOREIGN KEY ("blocking_skill_id") REFERENCES "public"."skill"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_feedback" ADD CONSTRAINT "teacher_feedback_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_feedback" ADD CONSTRAINT "teacher_feedback_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_feedback" ADD CONSTRAINT "teacher_feedback_recommendation_id_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_feedback" ADD CONSTRAINT "teacher_feedback_assignment_id_content_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."content_assignment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generation" ADD CONSTRAINT "content_generation_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generation" ADD CONSTRAINT "content_generation_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_event" ADD CONSTRAINT "content_review_event_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_event" ADD CONSTRAINT "content_review_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_skill" ADD CONSTRAINT "content_skill_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_skill" ADD CONSTRAINT "content_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_source_reference" ADD CONSTRAINT "content_source_reference_content_version_id_content_version_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_source_reference" ADD CONSTRAINT "content_source_reference_source_chunk_id_source_chunk_id_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."source_chunk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_content_id_learning_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_content" ADD CONSTRAINT "course_content_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_content" ADD CONSTRAINT "course_content_content_id_learning_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_content" ADD CONSTRAINT "learning_content_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_content" ADD CONSTRAINT "learning_content_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunk" ADD CONSTRAINT "source_chunk_document_id_source_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."source_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrollment" ADD CONSTRAINT "classroom_enrollment_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrollment" ADD CONSTRAINT "classroom_enrollment_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_group" ADD CONSTRAINT "classroom_group_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_group_member" ADD CONSTRAINT "classroom_group_member_group_id_classroom_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."classroom_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_group_member" ADD CONSTRAINT "classroom_group_member_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_skill" ADD CONSTRAINT "course_skill_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_skill" ADD CONSTRAINT "course_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_prerequisite" ADD CONSTRAINT "skill_prerequisite_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_prerequisite" ADD CONSTRAINT "skill_prerequisite_prerequisite_skill_id_skill_id_fk" FOREIGN KEY ("prerequisite_skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_assignment_version_idx" ON "content_assignment" USING btree ("content_version_id");--> statement-breakpoint
CREATE INDEX "learner_skill_mastery_skill_idx" ON "learner_skill_mastery" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "learning_attempt_learner_completed_idx" ON "learning_attempt" USING btree ("learner_id","completed_at");--> statement-breakpoint
CREATE INDEX "mastery_evidence_learner_skill_recorded_idx" ON "mastery_evidence" USING btree ("learner_id","skill_id","recorded_at");--> statement-breakpoint
CREATE INDEX "recommendation_run_learner_idx" ON "recommendation_run" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "teacher_feedback_teacher_idx" ON "teacher_feedback" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "content_generation_version_idx" ON "content_generation" USING btree ("content_version_id");--> statement-breakpoint
CREATE INDEX "content_review_event_version_idx" ON "content_review_event" USING btree ("content_version_id");--> statement-breakpoint
CREATE INDEX "content_skill_skill_idx" ON "content_skill" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "content_version_status_idx" ON "content_version" USING btree ("status","content_id");--> statement-breakpoint
CREATE INDEX "learning_content_course_idx" ON "learning_content" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "source_document_uploaded_by_idx" ON "source_document" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "classroom_teacher_idx" ON "classroom" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "classroom_enrollment_learner_idx" ON "classroom_enrollment" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "course_grade_level_idx" ON "course" USING btree ("grade_level");--> statement-breakpoint
CREATE INDEX "skill_grade_level_idx" ON "skill" USING btree ("grade_level");