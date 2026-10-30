import { z } from 'zod';
import {
  CardFace,
  CardFields,
  MyCard,
  RESUME_UPLOAD_LIMITS,
  ResumeDraft,
  UpdateCardRequest,
} from './cards';
import { Id, PersonName, Timestamp } from './common';
import {
  ContactDetails,
  ContactSharing,
  SharedContact,
  UpdateContactDetailsRequest,
} from './contacts';
import { hasBaseballCard, type Role } from './roles';
import { TeamSummary } from './teams';
import { UserSummary } from './users';

/**
 * Profiles, privacy settings and the athlete's own Baseball Card workflow (PRD §2, §4, §6).
 *
 * A profile's shape depends on who it belongs to, and the API picks what the viewer may see:
 * - `person`: athletes, coaches, parents, alumni, staff, recruiters (plain profile, plus the card
 *   for athletes). Contact details are only the channels shared with the viewer's audience.
 * - `teen`: a teen child's account. No contact details, no card, no communities: visible only to
 *   their own team.
 * - `child`: an under-13 profile the parent runs. No account. Visible only to the team and family.
 */

/**
 * A community as a profile lists it. Medical communities can't be expressed here at all: joining
 * one is never shown on a profile (PRD §5). Private communities aren't listed either.
 */
export const PROFILE_COMMUNITY_KINDS = ['team', 'team_impact', 'interest'] as const;
export const ProfileCommunity = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(PROFILE_COMMUNITY_KINDS),
});
export type ProfileCommunity = z.infer<typeof ProfileCommunity>;

export const PersonProfile = z.object({
  kind: z.literal('person'),
  user: UserSummary,
  /** Teams the viewer may know about: a parent's teams show only to people on them. */
  teams: z.array(TeamSummary),
  communities: z.array(ProfileCommunity),
  /** Athletes' published card, if the viewer may see it. Contacts are never on the face. */
  card: CardFace.nullable(),
  /** Only the channels shared with the viewer. Always empty for teen viewers. */
  contact: SharedContact,
});
export type PersonProfile = z.infer<typeof PersonProfile>;

/** A teen child's account as their team sees it. No contact field, card or communities. */
export const TeenProfile = z.object({
  kind: z.literal('teen'),
  user: UserSummary,
  teams: z.array(TeamSummary),
});
export type TeenProfile = z.infer<typeof TeenProfile>;

/** Under 13. Ages 13 and up have their own (teen) account. */
export const ChildAge = z.number().int().min(1).max(12);

export const ChildBio = z.string().trim().max(300);

/** PRD F3: first name, team, photo, age, optional interests bio. No birthdate, no health data. */
export const ChildProfile = z.object({
  kind: z.literal('child'),
  id: Id,
  firstName: PersonName,
  age: ChildAge,
  photoUrl: z.url().nullable(),
  bio: ChildBio.nullable(),
  /** Null once their parent has left the team: the child leaves with them. */
  team: TeamSummary.nullable(),
  parent: UserSummary,
});
export type ChildProfile = z.infer<typeof ChildProfile>;

export const Profile = z.discriminatedUnion('kind', [PersonProfile, TeenProfile, ChildProfile]);
export type Profile = z.infer<typeof Profile>;

/**
 * The parent edits their child's profile. Strict, so nothing else (recruiting, cards, contacts)
 * can be set on a child even by mistake.
 */
export const UpdateChildRequest = z.strictObject({
  firstName: PersonName.optional(),
  age: ChildAge.optional(),
  bio: ChildBio.nullable().optional(),
});
export type UpdateChildRequest = z.infer<typeof UpdateChildRequest>;

// Privacy and contact settings -------------------------------------------------------------------

/** Only athletes (current or alumni) can be open to recruiting; never teens or children. */
export const canBeOpenToRecruiting = (role: Role): boolean => hasBaseballCard(role);

export const RecruitingSetting = z.object({
  on: z.boolean(),
  /** False when the switch can't be turned on; `reason` says why. */
  allowed: z.boolean(),
  reason: z.string().nullable(),
});
export type RecruitingSetting = z.infer<typeof RecruitingSetting>;

/** "Recruiters can find me through this community", per official community (TI-116). */
export const SearchableSetting = z.object({
  community: z.object({ id: Id, name: z.string() }),
  on: z.boolean(),
});
export type SearchableSetting = z.infer<typeof SearchableSetting>;

/** The signed-in user's privacy settings. Card-holder fields are null for everyone else. */
export const MySettings = z.object({
  /** The athlete's own details, as they edit them. */
  contact: ContactDetails.nullable(),
  familiesSee: ContactSharing.nullable(),
  recruitersSee: ContactSharing.nullable(),
  cardPublished: z.boolean(),
  openToRecruiting: RecruitingSetting,
  searchable: z.array(SearchableSetting),
});
export type MySettings = z.infer<typeof MySettings>;

export const UpdateMySettingsRequest = z.strictObject({
  contact: UpdateContactDetailsRequest.optional(),
  familiesSee: ContactSharing.partial().optional(),
  recruitersSee: ContactSharing.partial().optional(),
  openToRecruiting: z.boolean().optional(),
  searchable: z
    .array(z.object({ communityId: Id, on: z.boolean() }))
    .max(50)
    .optional(),
});
export type UpdateMySettingsRequest = z.infer<typeof UpdateMySettingsRequest>;

// The athlete's own card: draft, resume, publish, history, export --------------------------------

/** Base64 grows a file by 4/3; the decoded size is checked against `maxBytes` again on the server. */
const MAX_BASE64_LENGTH = Math.ceil(RESUME_UPLOAD_LIMITS.maxBytes / 3) * 4;

export const ResumeUploadRequest = z.strictObject({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(RESUME_UPLOAD_LIMITS.mimeTypes),
  sizeBytes: z.number().int().positive().max(RESUME_UPLOAD_LIMITS.maxBytes),
  /**
   * The file itself. It is read in memory and dropped as soon as extraction ends; it is never
   * stored (TI-113). Its first bytes must match `mimeType`.
   */
  fileBase64: z.base64().max(MAX_BASE64_LENGTH).optional(),
  /** Mock only: the resume's text, standing in for the parsed file. */
  text: z.string().max(20_000).optional(),
});
export type ResumeUploadRequest = z.infer<typeof ResumeUploadRequest>;

/** Why a resume couldn't be read; the athlete types their card in instead. */
export const RESUME_FAIL_REASONS = [
  'unreadable',
  'no_text',
  'ocr_unavailable',
  'ocr_failed',
  'nothing_found',
] as const;

/**
 * What the extractor read, waiting on the athlete. `unconfirmed` until they accept fields, and
 * nothing in it reaches the card, the draft or anyone else before then. Values are plain text.
 */
export const ResumeExtraction = ResumeDraft.extend({
  status: z.literal('unconfirmed'),
  fileName: z.string(),
  /** Extraction found nothing usable: the athlete types the fields instead. */
  failed: z.boolean(),
  failReason: z.enum(RESUME_FAIL_REASONS).nullable(),
  /**
   * Low-confidence fields, a subset of `needsReview`. The review screen flags them "Check" and
   * leaves them unaccepted, so the athlete has to look before they reach the draft.
   */
  check: z.array(CardFields.keyof()),
  /** Indexes into `fields.experience` of entries to check (usually unclear dates). */
  checkEntries: z.array(z.number().int().min(0)),
});
export type ResumeExtraction = z.infer<typeof ResumeExtraction>;

/** The fields the athlete accepted (and possibly corrected). They go into the draft only. */
export const ConfirmResumeRequest = z.strictObject({
  draftId: Id,
  fields: UpdateCardRequest,
});
export type ConfirmResumeRequest = z.infer<typeof ConfirmResumeRequest>;

/** Everything the card screens need in one read. */
export const MyCardState = z.object({
  /** The stored card (published or not); null before the first publish. */
  card: MyCard.nullable(),
  /** Unpublished edits. Only the athlete sees them; publishing makes them the card. */
  draft: UpdateCardRequest.nullable(),
  pendingResume: ResumeExtraction.nullable(),
});
export type MyCardState = z.infer<typeof MyCardState>;

/** One published version of a card, per season (PRD A9). */
export const CardVersion = z.object({
  version: z.number().int().min(1),
  season: z.number().int(),
  publishedAt: Timestamp,
  face: CardFace,
});
export type CardVersion = z.infer<typeof CardVersion>;

/** What a PNG export may draw: the published face, never contact details. Athletes only. */
export const CardExport = z.object({
  face: CardFace,
  fileName: z.string(),
});
export type CardExport = z.infer<typeof CardExport>;

/** Card fields the resume reader looks for, in review order. */
export const EXTRACTABLE_CARD_FIELDS = [
  'firstName',
  'lastName',
  'position',
  'jerseyNumber',
  'classYear',
  'major',
  'hometown',
  'city',
  'region',
  'experience',
  'skills',
  'lookingFor',
] as const satisfies readonly (keyof CardFields)[];
