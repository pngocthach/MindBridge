CREATE TABLE "recommendation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"learner_id" text NOT NULL,
	"helpful" boolean NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_feedback_recommendation_unique" UNIQUE("recommendation_id")
);
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendation_feedback_learner_idx" ON "recommendation_feedback" USING btree ("learner_id");