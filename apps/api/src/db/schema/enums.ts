import { pgEnum } from 'drizzle-orm/pg-core';
import { ROLES } from '@team-impact/contracts';

// Identity
export const userType = pgEnum('user_type', ROLES);
export const userStatus = pgEnum('user_status', ['active', 'suspended']);
export const channelPreference = pgEnum('channel_preference', ['push', 'email', 'both', 'none']);
export const contactScope = pgEnum('contact_scope', ['family', 'recruiter']);
export const contactChannel = pgEnum('contact_channel', ['phone', 'email', 'linkedin']);
export const devicePlatform = pgEnum('device_platform', ['ios', 'android', 'web']);

// Teams and groups
export const teamGender = pgEnum('team_gender', ['men', 'women', 'coed']);
export const teamStatus = pgEnum('team_status', ['live', 'archived']);
export const groupKind = pgEnum('group_kind', ['team', 'college', 'affinity', 'org', 'platform']);
export const groupVisibility = pgEnum('group_visibility', ['open', 'members']);
export const membershipRole = pgEnum('membership_role', ['member', 'coach', 'admin']);
export const membershipSource = pgEnum('membership_source', [
  'signup',
  'join_request',
  'join_code',
  'coach_added',
  'coach_invite',
  'roster_import',
]);
export const joinRequestStatus = pgEnum('join_request_status', ['pending', 'approved', 'declined']);

// Card and media
export const cardStatus = pgEnum('card_status', ['draft', 'published', 'unclaimed', 'archived']);
export const mediaKind = pgEnum('media_kind', ['photo', 'resume']);
// Extracted resume text is untrusted: nothing in parsed_payload is shown until it is `confirmed`.
export const parseStatus = pgEnum('parse_status', ['pending', 'parsed', 'confirmed', 'failed']);
export const ingestedStatus = pgEnum('ingested_status', [
  'unmatched',
  'matched',
  'invited',
  'claimed',
  'rejected',
]);

// Community. Every post, comment and event starts `pending` and appears only once `approved`.
export const moderationStatus = pgEnum('moderation_status', [
  'pending',
  'approved',
  'rejected',
  'removed',
]);
export const postType = pgEnum('post_type', ['text', 'photo', 'announcement']);
export const postVisibility = pgEnum('post_visibility', ['group', 'network']);
export const reactionKind = pgEnum('reaction_kind', ['like', 'cheer', 'fire']);
export const rsvpState = pgEnum('rsvp_state', ['going', 'maybe', 'not_going']);

// Employer side
export const orgTier = pgEnum('org_tier', ['standard', 'premium']);
export const orgStatus = pgEnum('org_status', ['active', 'suspended']);
export const shortlistEntryStatus = pgEnum('shortlist_entry_status', ['active', 'withdrawn']);

// Safety
export const targetType = pgEnum('target_type', [
  'user',
  'card',
  'post',
  'comment',
  'event',
  'group',
]);
export const reportState = pgEnum('report_state', ['open', 'actioned', 'dismissed']);
export const reportSeverity = pgEnum('report_severity', ['low', 'medium', 'high']);
export const moderationAction = pgEnum('moderation_action', [
  'dismiss',
  'remove',
  'warn',
  'suspend',
  'appeal',
  'uphold',
  'overturn',
]);
