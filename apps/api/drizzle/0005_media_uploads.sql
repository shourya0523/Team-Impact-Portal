-- TI-111: one upload path. media.kind becomes purpose, plus status, caps, rights and takedown
-- columns; child photos move from a raw storage key on children into media.
CREATE TYPE "public"."media_purpose" AS ENUM('card_photo', 'child_photo', 'post_image', 'resume');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready', 'taken_down');--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "purpose" "media_purpose";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "status" "media_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "child_id" uuid;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "rights_affirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "taken_down_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "photo_media_id" uuid;--> statement-breakpoint
-- Rows from before this migration only ever came from the seed: their size is unknown, so it is 0.
UPDATE "media" SET
  "purpose" = CASE "kind" WHEN 'photo' THEN 'card_photo' ELSE 'resume' END::"media_purpose",
  "status" = 'ready',
  "mime_type" = CASE "kind" WHEN 'photo' THEN 'image/jpeg' ELSE 'application/pdf' END,
  "size_bytes" = 0;--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."media_kind";--> statement-breakpoint
INSERT INTO "media" ("owner_user_id", "purpose", "status", "child_id", "storage_key", "mime_type", "size_bytes", "created_at")
  SELECT "parent_user_id", 'child_photo', 'ready', "id", "photo_storage_key", 'image/jpeg', 0, "created_at"
  FROM "children" WHERE "photo_storage_key" IS NOT NULL;--> statement-breakpoint
UPDATE "children" c SET "photo_media_id" = m."id"
  FROM "media" m WHERE m."child_id" = c."id" AND m."storage_key" = c."photo_storage_key";--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "purpose" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "mime_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "size_bytes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_photo_media_id_media_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_child_id_idx" ON "media" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "children_photo_media_id_idx" ON "children" USING btree ("photo_media_id");--> statement-breakpoint
ALTER TABLE "children" DROP COLUMN "photo_storage_key";
