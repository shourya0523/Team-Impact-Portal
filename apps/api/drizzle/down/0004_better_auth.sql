-- Reverses 0002_better_auth.sql. Run with `pnpm --filter @team-impact/api db:rollback`.
-- Password hashes come back from the email-and-password sign-in rows before those tables go.
ALTER TABLE "users" ADD COLUMN "password_hash" text;
UPDATE "users" u SET "password_hash" = a."password"
  FROM "auth_accounts" a WHERE a."user_id" = u."id" AND a."provider_id" = 'credential';
-- Accounts created after the upgrade with no password (none today) get an unusable placeholder.
UPDATE "users" SET "password_hash" = '!' WHERE "password_hash" IS NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "email_verified";
ALTER TABLE "users" DROP COLUMN "image";
ALTER TABLE "users" DROP COLUMN "updated_at";
DROP TABLE IF EXISTS "auth_sessions" CASCADE;
DROP TABLE IF EXISTS "auth_accounts" CASCADE;
DROP TABLE IF EXISTS "auth_verifications" CASCADE;
