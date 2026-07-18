CREATE TABLE "learner_lesson_progress" (
	"learner_id" text NOT NULL,
	"content_id" uuid NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learner_lesson_progress_unique" UNIQUE("learner_id","content_id")
);
--> statement-breakpoint
ALTER TABLE "learner_lesson_progress" ADD CONSTRAINT "learner_lesson_progress_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_lesson_progress" ADD CONSTRAINT "learner_lesson_progress_content_id_learning_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learner_lesson_progress_learner_idx" ON "learner_lesson_progress" USING btree ("learner_id");