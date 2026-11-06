ALTER TABLE "events_log" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "events_log" ADD CONSTRAINT "events_log_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_log_subject_id_idx" ON "events_log" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "events_log_occurred_at_idx" ON "events_log" USING btree ("occurred_at");