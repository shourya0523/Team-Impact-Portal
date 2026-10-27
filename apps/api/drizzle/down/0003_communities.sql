-- Reverses 0003_communities.sql. Run with `pnpm --filter @team-impact/api db:rollback`.
-- Lossy where the old model has no slot: medical and interest communities both come back as
-- affinity groups (private ones members-only), alumni mentors come back as alumni, and
-- notifications, community join requests, QR labels and lifetimes, team about text and event
-- details and end times are dropped; invited teams come back as live. College and org
-- groups deleted on the way up are not recreated.
DROP TABLE "notifications";
DROP TABLE "community_join_requests";
DROP TYPE "public"."notification_kind";
DROP TYPE "public"."notification_target";

ALTER TABLE "join_codes" DROP COLUMN "lifetime";
ALTER TABLE "join_codes" DROP COLUMN "label";
ALTER TABLE "join_codes" DROP COLUMN "short_code";
DROP TYPE "public"."qr_code_lifetime";

ALTER TABLE "teams" DROP COLUMN "about";
ALTER TABLE "events" DROP COLUMN "details";
ALTER TABLE "events" DROP COLUMN "ends_at";
ALTER TABLE "events" RENAME COLUMN "community_id" TO "group_id";
ALTER TABLE "events" RENAME CONSTRAINT "events_community_id_communities_id_fk" TO "events_group_id_groups_id_fk";
ALTER INDEX "events_community_starts_idx" RENAME TO "events_group_starts_idx";

CREATE TYPE "public"."post_visibility" AS ENUM('group', 'network');
ALTER TABLE "posts" ADD COLUMN "visibility" "post_visibility" DEFAULT 'group' NOT NULL;
UPDATE "posts" p SET "visibility" = 'network'
FROM "communities" c WHERE c."id" = p."community_id" AND c."kind" = 'team_impact';
ALTER TABLE "posts" RENAME COLUMN "community_id" TO "group_id";
ALTER TABLE "posts" RENAME CONSTRAINT "posts_community_id_communities_id_fk" TO "posts_group_id_groups_id_fk";
ALTER INDEX "posts_community_created_idx" RENAME TO "posts_group_created_idx";
CREATE INDEX "posts_network_feed_idx" ON "posts" USING btree ("created_at") WHERE "posts"."status" = 'approved' and "posts"."visibility" = 'network';

ALTER TABLE "memberships" RENAME COLUMN "community_id" TO "group_id";
ALTER TABLE "memberships" RENAME COLUMN "recruiter_search_opt_in" TO "searchable";
ALTER TABLE "memberships" RENAME CONSTRAINT "memberships_community_id_communities_id_fk" TO "memberships_group_id_groups_id_fk";
ALTER TABLE "memberships" RENAME CONSTRAINT "memberships_user_community_season_key" TO "memberships_user_group_season_key";
ALTER INDEX "memberships_community_id_idx" RENAME TO "memberships_group_id_idx";

CREATE TYPE "public"."group_kind" AS ENUM('team', 'college', 'affinity', 'org', 'platform');
CREATE TYPE "public"."group_visibility" AS ENUM('open', 'members');
DROP INDEX "communities_kind_name_key";
ALTER TABLE "communities" DROP CONSTRAINT "communities_team_id_check";
ALTER TABLE "communities" DROP CONSTRAINT "communities_private_check";
ALTER TABLE "communities" DROP CONSTRAINT "communities_official_check";
ALTER TABLE "communities" ADD COLUMN "old_kind" "group_kind";
ALTER TABLE "communities" ADD COLUMN "visibility" "group_visibility" DEFAULT 'members' NOT NULL;
UPDATE "communities" SET
  "old_kind" = CASE "kind" WHEN 'team' THEN 'team' WHEN 'team_impact' THEN 'platform' ELSE 'affinity' END::"group_kind",
  "visibility" = CASE WHEN "kind" = 'team' OR "private" THEN 'members' ELSE 'open' END::"group_visibility";
ALTER TABLE "communities" DROP COLUMN "kind";
ALTER TABLE "communities" RENAME COLUMN "old_kind" TO "kind";
ALTER TABLE "communities" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "communities" DROP COLUMN "about";
ALTER TABLE "communities" DROP COLUMN "private";
ALTER TABLE "communities" DROP COLUMN "status";
ALTER TABLE "communities" ADD COLUMN "college_id" uuid;
ALTER TABLE "communities" ADD COLUMN "org_id" uuid;
ALTER TABLE "communities" RENAME TO "groups";
ALTER TABLE "groups" RENAME CONSTRAINT "communities_pkey" TO "groups_pkey";
ALTER TABLE "groups" RENAME CONSTRAINT "communities_team_id_unique" TO "groups_team_id_unique";
ALTER TABLE "groups" RENAME CONSTRAINT "communities_team_id_teams_id_fk" TO "groups_team_id_teams_id_fk";
ALTER TABLE "groups" RENAME CONSTRAINT "communities_created_by_users_id_fk" TO "groups_created_by_users_id_fk";
ALTER INDEX "communities_created_by_idx" RENAME TO "groups_created_by_idx";
ALTER TABLE "groups" ADD CONSTRAINT "groups_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "groups" ADD CONSTRAINT "groups_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "groups_college_id_idx" ON "groups" USING btree ("college_id");
CREATE INDEX "groups_org_id_idx" ON "groups" USING btree ("org_id");
DROP TYPE "public"."community_kind";

ALTER TYPE "public"."target_type" RENAME VALUE 'community' TO 'group';
-- Postgres can't drop an enum value, so user_type is rebuilt without alumni_mentor.
ALTER TYPE "public"."user_type" RENAME TO "user_type_0002";
CREATE TYPE "public"."user_type" AS ENUM('athlete', 'alumni', 'recruiter', 'staff', 'coach', 'parent', 'teen');
ALTER TABLE "users" ALTER COLUMN "user_type" TYPE "user_type" USING (
  CASE "user_type"::text WHEN 'alumni_athlete' THEN 'alumni' WHEN 'alumni_mentor' THEN 'alumni' ELSE "user_type"::text END
)::"user_type";
DROP TYPE "public"."user_type_0002";
-- Same for team_status: invited teams come back as live.
ALTER TABLE "teams" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "public"."team_status" RENAME TO "team_status_0002";
CREATE TYPE "public"."team_status" AS ENUM('live', 'archived');
ALTER TABLE "teams" ALTER COLUMN "status" TYPE "team_status" USING (
  CASE "status"::text WHEN 'invited' THEN 'live' ELSE "status"::text END
)::"team_status";
ALTER TABLE "teams" ALTER COLUMN "status" SET DEFAULT 'live';
DROP TYPE "public"."team_status_0002";
