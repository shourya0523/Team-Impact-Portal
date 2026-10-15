CREATE TABLE "events_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events_log" ADD CONSTRAINT "events_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_log" ADD CONSTRAINT "events_log_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_log_name_occurred_at_idx" ON "events_log" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "events_log_occurred_at_idx" ON "events_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "events_log_user_id_idx" ON "events_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_log_subject_id_idx" ON "events_log" USING btree ("subject_id");