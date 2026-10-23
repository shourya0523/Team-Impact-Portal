-- Groups become communities (PRD v2.3 §5) and the other schema gaps close (TI Postgres ticket).
-- Reverse with `pnpm --filter @team-impact/api db:rollback` (drizzle/down/0002_communities.sql).
--
-- Kinds map team -> team, platform -> team_impact, affinity -> interest. College and org groups
-- have no community equivalent (recruiters join nothing), so they are deleted with their posts,
-- events and memberships. An affinity group that was members-only becomes a private interest
-- community unless it was official: official ones stay open, since a private one can't be official.

-- Alumni split (PRD §2, §8). Existing alumni were all former athletes.
ALTER TYPE "public"."user_type" RENAME VALUE 'alumni' TO 'alumni_athlete';--> statement-breakpoint
ALTER TYPE "public"."user_type" ADD VALUE 'alumni_mentor' AFTER 'alumni_athlete';--> statement-breakpoint
ALTER TYPE "public"."target_type" RENAME VALUE 'group' TO 'community';--> statement-breakpoint
ALTER TYPE "public"."team_status" ADD VALUE 'invited' BEFORE 'live';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "about" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint

CREATE TYPE "public"."community_kind" AS ENUM('team', 'team_impact', 'medical', 'interest');--> statement-breakpoint
CREATE TYPE "public"."qr_code_lifetime" AS ENUM('tonight', 'day', 'week');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('join_approved', 'reply', 'event', 'announcement', 'warning');--> statement-breakpoint
CREATE TYPE "public"."notification_target" AS ENUM('post', 'event', 'community');--> statement-breakpoint

DELETE FROM "groups" WHERE "kind" IN ('college', 'org');--> statement-breakpoint
ALTER TABLE "groups" RENAME TO "communities";--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "new_kind" "community_kind";--> statement-breakpoint
UPDATE "communities" SET "new_kind" = CASE "kind"
  WHEN 'team' THEN 'team'
  WHEN 'platform' THEN 'team_impact'
  ELSE 'interest'
END::"community_kind";--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "communities" RENAME COLUMN "new_kind" TO "kind";--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "about" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Everything that already existed was live, so it counts as approved.
ALTER TABLE "communities" ADD COLUMN "status" "moderation_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
UPDATE "communities" SET "private" = ("visibility" = 'members' AND NOT "official") WHERE "kind" = 'interest';--> statement-breakpoint
UPDATE "communities" SET "official" = false WHERE "kind" <> 'interest';--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "college_id";--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "communities" RENAME CONSTRAINT "groups_pkey" TO "communities_pkey";--> statement-breakpoint
ALTER TABLE "communities" RENAME CONSTRAINT "groups_team_id_unique" TO "communities_team_id_unique";--> statement-breakpoint
ALTER TABLE "communities" RENAME CONSTRAINT "groups_team_id_teams_id_fk" TO "communities_team_id_teams_id_fk";--> statement-breakpoint
ALTER TABLE "communities" RENAME CONSTRAINT "groups_created_by_users_id_fk" TO "communities_created_by_users_id_fk";--> statement-breakpoint
ALTER INDEX "groups_created_by_idx" RENAME TO "communities_created_by_idx";--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_team_id_check" CHECK (("kind" = 'team') = ("team_id" is not null));--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_private_check" CHECK (not "private" or "kind" in ('interest', 'medical'));--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_official_check" CHECK (not "official" or ("kind" = 'interest' and not "private"));--> statement-breakpoint
CREATE UNIQUE INDEX "communities_kind_name_key" ON "communities" USING btree ("kind",lower("name")) WHERE "kind" in ('interest', 'medical');--> statement-breakpoint
DROP TYPE "public"."group_kind";--> statement-breakpoint
DROP TYPE "public"."group_visibility";--> statement-breakpoint

ALTER TABLE "memberships" RENAME COLUMN "group_id" TO "community_id";--> statement-breakpoint
ALTER TABLE "memberships" RENAME COLUMN "searchable" TO "recruiter_search_opt_in";--> statement-breakpoint
-- Opting in to recruiter search only means something in official interest communities.
UPDATE "memberships" m SET "recruiter_search_opt_in" = false
FROM "communities" c WHERE c."id" = m."community_id" AND NOT (c."kind" = 'interest' AND c."official");--> statement-breakpoint
ALTER TABLE "memberships" RENAME CONSTRAINT "memberships_group_id_groups_id_fk" TO "memberships_community_id_communities_id_fk";--> statement-breakpoint
ALTER TABLE "memberships" RENAME CONSTRAINT "memberships_user_group_season_key" TO "memberships_user_community_season_key";--> statement-breakpoint
ALTER INDEX "memberships_group_id_idx" RENAME TO "memberships_community_id_idx";--> statement-breakpoint

ALTER TABLE "posts" RENAME COLUMN "group_id" TO "community_id";--> statement-breakpoint
ALTER TABLE "posts" RENAME CONSTRAINT "posts_group_id_groups_id_fk" TO "posts_community_id_communities_id_fk";--> statement-breakpoint
ALTER INDEX "posts_group_created_idx" RENAME TO "posts_community_created_idx";--> statement-breakpoint
-- Network-wide posts now live in the Team Impact community.
DROP INDEX "posts_network_feed_idx";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "visibility";--> statement-breakpoint
DROP TYPE "public"."post_visibility";--> statement-breakpoint

ALTER TABLE "events" RENAME COLUMN "group_id" TO "community_id";--> statement-breakpoint
ALTER TABLE "events" RENAME CONSTRAINT "events_group_id_groups_id_fk" TO "events_community_id_communities_id_fk";--> statement-breakpoint
ALTER INDEX "events_group_starts_idx" RENAME TO "events_community_starts_idx";--> statement-breakpoint

CREATE TABLE "community_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "community_join_requests" ADD CONSTRAINT "community_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_join_requests" ADD CONSTRAINT "community_join_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_join_requests" ADD CONSTRAINT "community_join_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_join_requests_pending_key" ON "community_join_requests" USING btree ("community_id","user_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "community_join_requests_user_id_idx" ON "community_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "community_join_requests_decided_by_idx" ON "community_join_requests" USING btree ("decided_by");--> statement-breakpoint

-- QR lifetime (TI-149). Existing codes were all the one-week default. Short codes are backfilled
-- from a hash of the id (ids can share long runs of zeros); the alphabet and length match
-- QR_SHORT_CODE_ALPHABET in the contracts.
ALTER TABLE "join_codes" ADD COLUMN "short_code" text;--> statement-breakpoint
UPDATE "join_codes" SET "short_code" = (
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (get_byte(decode(md5("id"::text), 'hex'), i) % 31) + 1, 1), '' ORDER BY i)
  FROM generate_series(0, 7) AS i
);--> statement-breakpoint
ALTER TABLE "join_codes" ALTER COLUMN "short_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "join_codes" ADD CONSTRAINT "join_codes_short_code_unique" UNIQUE("short_code");--> statement-breakpoint
ALTER TABLE "join_codes" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "join_codes" ADD COLUMN "lifetime" "qr_code_lifetime" DEFAULT 'week' NOT NULL;--> statement-breakpoint

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"actor_id" uuid,
	"text" text NOT NULL,
	"target_kind" "notification_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"community_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE not "read";--> statement-breakpoint
CREATE INDEX "notifications_actor_id_idx" ON "notifications" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "notifications_community_id_idx" ON "notifications" USING btree ("community_id");
