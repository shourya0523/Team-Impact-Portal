CREATE TYPE "public"."card_status" AS ENUM('draft', 'published', 'unclaimed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."channel_preference" AS ENUM('push', 'email', 'both', 'none');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('phone', 'email', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."contact_scope" AS ENUM('family', 'recruiter');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."group_kind" AS ENUM('team', 'college', 'affinity', 'org', 'platform');--> statement-breakpoint
CREATE TYPE "public"."group_visibility" AS ENUM('open', 'members');--> statement-breakpoint
CREATE TYPE "public"."ingested_status" AS ENUM('unmatched', 'matched', 'invited', 'claimed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'resume');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('member', 'coach', 'admin');--> statement-breakpoint
CREATE TYPE "public"."membership_source" AS ENUM('signup', 'join_request', 'join_code', 'coach_added', 'coach_invite', 'roster_import');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('dismiss', 'remove', 'warn', 'suspend', 'appeal', 'uphold', 'overturn');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected', 'removed');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."org_tier" AS ENUM('standard', 'premium');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('pending', 'parsed', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('text', 'photo', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."post_visibility" AS ENUM('group', 'network');--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('like', 'cheer', 'fire');--> statement-breakpoint
CREATE TYPE "public"."report_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."report_state" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."rsvp_state" AS ENUM('going', 'maybe', 'not_going');--> statement-breakpoint
CREATE TYPE "public"."shortlist_entry_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('user', 'card', 'post', 'comment', 'event', 'group');--> statement-breakpoint
CREATE TYPE "public"."team_gender" AS ENUM('men', 'women', 'coed');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('live', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('athlete', 'alumni', 'recruiter', 'staff', 'coach', 'parent', 'teen');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"ingested_record_id" uuid,
	"season" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "card_status" DEFAULT 'draft' NOT NULL,
	"completeness" smallint DEFAULT 0 NOT NULL,
	"sport" text,
	"position" text,
	"grad_year" integer,
	"major" text,
	"region" text,
	"city" text,
	"division" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_athlete_season_version_key" UNIQUE("athlete_id","season","version"),
	CONSTRAINT "cards_has_owner" CHECK ("cards"."athlete_id" is not null or "cards"."ingested_record_id" is not null),
	CONSTRAINT "cards_completeness_range" CHECK ("cards"."completeness" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "ingested_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_ref" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"college_id" uuid,
	"years" text,
	"match_confidence" real,
	"status" "ingested_status" DEFAULT 'unmatched' NOT NULL,
	"claimed_by_user_id" uuid,
	"claim_token_hash" text,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "ingested_records_claim_token_hash_unique" UNIQUE("claim_token_hash"),
	CONSTRAINT "ingested_records_source_ref_key" UNIQUE("source","source_ref")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"parse_status" "parse_status",
	"parsed_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"host_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"type" "post_type" DEFAULT 'text' NOT NULL,
	"payload" jsonb NOT NULL,
	"visibility" "post_visibility" DEFAULT 'group' NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "reaction_kind" NOT NULL,
	CONSTRAINT "reactions_post_user_kind_key" UNIQUE("post_id","user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "rsvp_state" NOT NULL,
	"checked_in_at" timestamp with time zone,
	CONSTRAINT "rsvps_event_user_key" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "org_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"domain" text NOT NULL,
	CONSTRAINT "org_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tier" "org_tier" DEFAULT 'standard' NOT NULL,
	"status" "org_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"filter_json" jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_result_ids" jsonb
);
--> statement-breakpoint
CREATE TABLE "shortlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shortlist_id" uuid NOT NULL,
	"athlete_id" uuid,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "shortlist_entry_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "shortlist_entries_list_athlete_key" UNIQUE("shortlist_id","athlete_id")
);
--> statement-breakpoint
CREATE TABLE "shortlist_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shortlist_entry_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shortlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_blocked_key" UNIQUE("blocker_id","blocked_id"),
	CONSTRAINT "blocks_not_self" CHECK ("blocks"."blocker_id" <> "blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" uuid NOT NULL,
	"team_id" uuid,
	"first_name" text NOT NULL,
	"photo_storage_key" text,
	"age" smallint NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "children_age_under_13" CHECK ("children"."age" between 0 and 12)
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"flag" text NOT NULL,
	"value" boolean NOT NULL,
	"terms_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "contact_scope" NOT NULL,
	"channel" "contact_channel" NOT NULL,
	"visible" boolean DEFAULT false NOT NULL,
	CONSTRAINT "contact_visibility_user_scope_channel_key" UNIQUE("user_id","scope","channel")
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "device_platform" NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_type" "user_type" NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" date NOT NULL,
	"email_verified_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"open_to_recruiting" boolean DEFAULT false NOT NULL,
	"channel_preference" "channel_preference" DEFAULT 'both' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"college_id" uuid,
	"hometown" text,
	"major" text,
	"grad_year" integer,
	"industry" text,
	"job_title" text,
	"hiring" boolean,
	"mentoring" boolean,
	"org_id" uuid,
	"current_employer" text,
	"phone" text,
	"linkedin_url" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "coach_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "colleges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "colleges_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "group_kind" NOT NULL,
	"name" text NOT NULL,
	"visibility" "group_visibility" DEFAULT 'members' NOT NULL,
	"team_id" uuid,
	"college_id" uuid,
	"org_id" uuid,
	"official" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_team_id_unique" UNIQUE("team_id"),
	CONSTRAINT "groups_official_affinity_only" CHECK (not "groups"."official" or "groups"."kind" = 'affinity')
);
--> statement-breakpoint
CREATE TABLE "join_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "join_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"season" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "membership_source" NOT NULL,
	"searchable" boolean DEFAULT false NOT NULL,
	"join_code_id" uuid,
	"added_by" uuid,
	CONSTRAINT "memberships_user_group_season_key" UNIQUE NULLS NOT DISTINCT("user_id","group_id","season")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"college_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"gender" "team_gender" NOT NULL,
	"division" text,
	"display_name" text NOT NULL,
	"color" text,
	"logo_storage_key" text,
	"status" "team_status" DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_college_sport_gender_key" UNIQUE("college_id","sport","gender"),
	CONSTRAINT "teams_color_hex" CHECK ("teams"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "events_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"target_type" "target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"action" "moderation_action" NOT NULL,
	"parent_action_id" uuid,
	"reason" text,
	"content_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" "target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"state" "report_state" DEFAULT 'open' NOT NULL,
	"severity" "report_severity",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_athlete_id_users_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_ingested_record_id_ingested_records_id_fk" FOREIGN KEY ("ingested_record_id") REFERENCES "public"."ingested_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_records" ADD CONSTRAINT "ingested_records_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_records" ADD CONSTRAINT "ingested_records_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_domains" ADD CONSTRAINT "org_domains_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_entries" ADD CONSTRAINT "shortlist_entries_shortlist_id_shortlists_id_fk" FOREIGN KEY ("shortlist_id") REFERENCES "public"."shortlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_entries" ADD CONSTRAINT "shortlist_entries_athlete_id_users_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_entries" ADD CONSTRAINT "shortlist_entries_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_notes" ADD CONSTRAINT "shortlist_notes_shortlist_entry_id_shortlist_entries_id_fk" FOREIGN KEY ("shortlist_entry_id") REFERENCES "public"."shortlist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_notes" ADD CONSTRAINT "shortlist_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_visibility" ADD CONSTRAINT "contact_visibility_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invites" ADD CONSTRAINT "coach_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invites" ADD CONSTRAINT "coach_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_codes" ADD CONSTRAINT "join_codes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_codes" ADD CONSTRAINT "join_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_join_code_id_join_codes_id_fk" FOREIGN KEY ("join_code_id") REFERENCES "public"."join_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_log" ADD CONSTRAINT "events_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_parent_action_id_moderation_actions_id_fk" FOREIGN KEY ("parent_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_ingested_record_id_idx" ON "cards" USING btree ("ingested_record_id");--> statement-breakpoint
CREATE INDEX "cards_published_sport_idx" ON "cards" USING btree ("sport") WHERE "cards"."status" = 'published';--> statement-breakpoint
CREATE INDEX "cards_published_grad_year_idx" ON "cards" USING btree ("grad_year") WHERE "cards"."status" = 'published';--> statement-breakpoint
CREATE INDEX "cards_published_major_idx" ON "cards" USING btree ("major") WHERE "cards"."status" = 'published';--> statement-breakpoint
CREATE INDEX "cards_published_region_idx" ON "cards" USING btree ("region") WHERE "cards"."status" = 'published';--> statement-breakpoint
CREATE INDEX "cards_published_city_idx" ON "cards" USING btree ("city") WHERE "cards"."status" = 'published';--> statement-breakpoint
CREATE INDEX "cards_published_division_idx" ON "cards" USING btree ("division") WHERE "cards"."status" = 'published';--> statement-breakpoint
CREATE INDEX "ingested_records_college_id_idx" ON "ingested_records" USING btree ("college_id");--> statement-breakpoint
CREATE INDEX "ingested_records_claimed_by_idx" ON "ingested_records" USING btree ("claimed_by_user_id");--> statement-breakpoint
CREATE INDEX "media_owner_user_id_idx" ON "media" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "comments_post_created_idx" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_id_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "events_group_starts_idx" ON "events" USING btree ("group_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_host_id_idx" ON "events" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "posts_group_created_idx" ON "posts" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_id_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_network_feed_idx" ON "posts" USING btree ("created_at") WHERE "posts"."status" = 'approved' and "posts"."visibility" = 'network';--> statement-breakpoint
CREATE INDEX "reactions_user_id_idx" ON "reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rsvps_user_id_idx" ON "rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_domains_org_id_idx" ON "org_domains" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "saved_searches_org_id_idx" ON "saved_searches" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "saved_searches_created_by_idx" ON "saved_searches" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "shortlist_entries_athlete_id_idx" ON "shortlist_entries" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "shortlist_entries_added_by_idx" ON "shortlist_entries" USING btree ("added_by");--> statement-breakpoint
CREATE INDEX "shortlist_notes_entry_id_idx" ON "shortlist_notes" USING btree ("shortlist_entry_id");--> statement-breakpoint
CREATE INDEX "shortlist_notes_author_id_idx" ON "shortlist_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "shortlists_org_id_idx" ON "shortlists" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "shortlists_created_by_idx" ON "shortlists" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "shortlists_one_default_per_org" ON "shortlists" USING btree ("org_id") WHERE "shortlists"."is_default";--> statement-breakpoint
CREATE INDEX "blocks_blocked_id_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "children_parent_user_id_idx" ON "children" USING btree ("parent_user_id");--> statement-breakpoint
CREATE INDEX "children_team_id_idx" ON "children" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "consent_records_user_flag_idx" ON "consent_records" USING btree ("user_id","flag","created_at");--> statement-breakpoint
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_college_id_idx" ON "users" USING btree ("college_id");--> statement-breakpoint
CREATE INDEX "users_org_id_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "users_pending_erasure_idx" ON "users" USING btree ("deleted_at") WHERE "users"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "coach_invites_team_id_idx" ON "coach_invites" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "coach_invites_invited_by_idx" ON "coach_invites" USING btree ("invited_by");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_invites_one_open_per_email" ON "coach_invites" USING btree ("team_id","email") WHERE "coach_invites"."accepted_at" is null and "coach_invites"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "groups_college_id_idx" ON "groups" USING btree ("college_id");--> statement-breakpoint
CREATE INDEX "groups_org_id_idx" ON "groups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "groups_created_by_idx" ON "groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "join_codes_team_id_idx" ON "join_codes" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "join_codes_created_by_idx" ON "join_codes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "join_requests_user_id_idx" ON "join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "join_requests_team_status_idx" ON "join_requests" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "join_requests_decided_by_idx" ON "join_requests" USING btree ("decided_by");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_one_pending" ON "join_requests" USING btree ("user_id","team_id") WHERE "join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "memberships_group_id_idx" ON "memberships" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "memberships_join_code_id_idx" ON "memberships" USING btree ("join_code_id");--> statement-breakpoint
CREATE INDEX "memberships_added_by_idx" ON "memberships" USING btree ("added_by");--> statement-breakpoint
CREATE INDEX "events_log_user_id_idx" ON "events_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_log_event_occurred_idx" ON "events_log" USING btree ("event","occurred_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_actor_id_idx" ON "moderation_actions" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_parent_id_idx" ON "moderation_actions" USING btree ("parent_action_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_reporter_id_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_queue_idx" ON "reports" USING btree ("state","severity");