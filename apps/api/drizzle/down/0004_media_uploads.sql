-- Reverses 0004_media_uploads.sql. Run with `pnpm --filter @team-impact/api db:rollback`.
-- Child photos go back to children.photo_storage_key; anything uploaded since is kept as a photo or resume.
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'resume');
ALTER TABLE "media" ADD COLUMN "kind" "media_kind";
ALTER TABLE "children" ADD COLUMN "photo_storage_key" text;
UPDATE "children" c SET "photo_storage_key" = m."storage_key" FROM "media" m WHERE m."id" = c."photo_media_id";
ALTER TABLE "children" DROP COLUMN "photo_media_id";
DELETE FROM "media" WHERE "purpose" = 'child_photo';
UPDATE "media" SET "kind" = CASE "purpose" WHEN 'resume' THEN 'resume' ELSE 'photo' END::"media_kind";
ALTER TABLE "media" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "media" DROP COLUMN "purpose";
ALTER TABLE "media" DROP COLUMN "status";
ALTER TABLE "media" DROP COLUMN "child_id";
ALTER TABLE "media" DROP COLUMN "mime_type";
ALTER TABLE "media" DROP COLUMN "size_bytes";
ALTER TABLE "media" DROP COLUMN "rights_affirmed_at";
ALTER TABLE "media" DROP COLUMN "taken_down_at";
DROP TYPE "public"."media_purpose";
DROP TYPE "public"."media_status";
