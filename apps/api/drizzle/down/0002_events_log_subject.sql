-- Reverses 0002_events_log_subject.sql. Run with `pnpm --filter @team-impact/api db:rollback`.
-- Rows keep their event and properties but lose who they were about.
DROP INDEX IF EXISTS "events_log_occurred_at_idx";
DROP INDEX IF EXISTS "events_log_subject_id_idx";
ALTER TABLE "events_log" DROP CONSTRAINT IF EXISTS "events_log_subject_id_users_id_fk";
ALTER TABLE "events_log" DROP COLUMN IF EXISTS "subject_id";
