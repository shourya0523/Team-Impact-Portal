import {
  canBeOpenToRecruiting,
  CardFields,
  type CardVersion,
  type ChildProfile,
  EXTRACTABLE_CARD_FIELDS,
  hasBaseballCard,
  type MyCardState,
  type MySettings,
  type Profile,
  type ProfileCommunity,
  type ResumeExtraction,
  type SharedContact,
  type UpdateCardRequest,
} from '@team-impact/contracts';
import * as fx from './fixtures';
import type { MockCard, MockUser } from './fixtures';
import type { MockWorld } from './world';
import type { MockChild } from './signup';

/**
 * Profiles, privacy settings and the athlete's own card workflow, on the mock world. State lives
 * in `ProfileState` (one per world); every helper is a pure function of the world and the viewer.
 * Hard rules enforced here (CLAUDE.md, PRD §2, §4, §6):
 * - child profiles (under 13 or teen) are visible only to their team and family;
 * - teens never get contact details;
 * - medical community membership is never on a profile;
 * - extracted resume text reaches nothing until the athlete confirms it;
 * - only athletes have a card, so children and teens never get one, published or exported.
 */

interface StoredVersion {
  version: number;
  season: number;
  publishedAt: string;
  face: MockCard['face'];
}

export interface ProfileState {
  /** athleteId → unpublished edits. */
  drafts: Map<string, UpdateCardRequest>;
  /** athleteId → extraction waiting on review. */
  resumes: Map<string, ResumeExtraction>;
  /** athleteId → published versions, oldest first. */
  history: Map<string, StoredVersion[]>;
  /** athleteId → last change to the card or its settings. */
  updatedAt: Map<string, string>;
}

const SEEDED = '2026-10-05T12:00:00.000Z';

export const createProfileState = (cards: MockCard[]): ProfileState => {
  const history = new Map<string, StoredVersion[]>();
  for (const card of cards.filter((c) => c.visibility.published)) {
    history.set(card.face.athleteId, [
      {
        version: 1,
        season: card.face.season,
        publishedAt: SEEDED,
        face: structuredClone(card.face),
      },
    ]);
  }
  // Jordan also has last season's card, to look back at.
  const jordan = cards.find((c) => c.face.athleteId === fx.USERS.jordan.id);
  if (jordan) {
    history.get(jordan.face.athleteId)?.unshift({
      version: 1,
      season: jordan.face.season - 1,
      publishedAt: '2025-10-01T12:00:00.000Z',
      face: {
        ...structuredClone(jordan.face),
        id: fx.id(611),
        season: jordan.face.season - 1,
        experience: 'Investment club member.',
        lookingFor: null,
      },
    });
  }
  return {
    drafts: new Map(),
    resumes: new Map(),
    history,
    updatedAt: new Map(),
  };
};

// Profiles -----------------------------------------------------------------------------------------

const sharesTeam = (world: MockWorld, a: string, b: string) => {
  const mine = new Set(world.teamIdsOf(a));
  return world.teamIdsOf(b).some((t) => mine.has(t));
};

/** Team and family only: the parent, and accounts on the child's team. Recruiters never. */
export const canSeeChild = (world: MockWorld, child: MockChild, u: MockUser) =>
  u.role !== 'recruiter' &&
  (u.id === child.parentId || world.teamIdsOf(u.id).includes(child.teamId));

export const childProfile = (world: MockWorld, child: MockChild): ChildProfile => ({
  kind: 'child',
  id: child.id,
  firstName: child.firstName,
  age: child.age,
  photoUrl: child.photoUrl,
  bio: child.bio,
  team: world.teamSummary(child.teamId),
  parent: fx.summaryOf(world.user(child.parentId)!),
});

/**
 * Communities a profile lists: the target's team communities and open, approved interest
 * communities the viewer can see. Never medical (PRD §5), never private, and none for recruiters,
 * so a membership the athlete didn't make searchable can't reach the employer side.
 */
const profileCommunities = (world: MockWorld, t: MockUser, u: MockUser): ProfileCommunity[] => {
  if (u.role === 'recruiter') return [];
  const teamIds = new Set(world.teamIdsOf(t.id));
  return world.communities
    .filter((c) => world.canSeeCommunity(c, u) && c.moderation === 'approved')
    .flatMap((c): ProfileCommunity[] => {
      if (c.kind === 'team')
        return teamIds.has(c.teamId) ? [{ id: c.id, name: c.name, kind: c.kind }] : [];
      if (c.kind !== 'interest' || c.private) return [];
      return c.members.some((m) => m.userId === t.id)
        ? [{ id: c.id, name: c.name, kind: c.kind }]
        : [];
    });
};

/** Whether `u` may open `t`'s plain profile at all. */
const canSeePerson = (world: MockWorld, t: MockUser, u: MockUser) => {
  if (t.id === u.id || u.role === 'staff' || t.role === 'staff') return true;
  if (u.role === 'recruiter') {
    // Athletes without open-to-recruiting don't exist on the employer side; colleagues do.
    if (t.role === 'recruiter') return t.companyId === u.companyId;
    const card = world.cards.find((c) => c.face.athleteId === t.id);
    return !!card && world.recruiterCanSee(card);
  }
  if (t.role === 'recruiter') return false;
  if (sharesTeam(world, t.id, u.id)) return true;
  if (t.role === 'alumni_athlete' || t.role === 'alumni_mentor') return true;
  // Fellow members of an open interest community (never medical or private ones).
  return world.communities.some(
    (c) =>
      c.kind === 'interest' &&
      !c.private &&
      c.moderation === 'approved' &&
      c.members.some((m) => m.userId === t.id) &&
      c.members.some((m) => m.userId === u.id),
  );
};

/** `id` may be a user or a child. Null when the viewer may not see it (the route says 404). */
export const profileFor = (world: MockWorld, id: string, u: MockUser): Profile | null => {
  const child = world.children.find((c) => c.id === id);
  if (child) return canSeeChild(world, child, u) ? childProfile(world, child) : null;

  const t = world.user(id);
  if (!t) return null;
  if (t.role === 'teen') {
    // Visible only to their own team (and themselves); recruiters never.
    const visible = t.id === u.id || (u.role !== 'recruiter' && sharesTeam(world, t.id, u.id));
    return visible
      ? { kind: 'teen', user: fx.summaryOf(t), teams: world.teamIdsOf(t.id).map(world.teamSummary) }
      : null;
  }
  if (!canSeePerson(world, t, u)) return null;

  const viewerTeams = new Set(world.teamIdsOf(u.id));
  const teams = world
    .teamIdsOf(t.id)
    // A parent's team points at their child, so only people on it see it.
    .filter(
      (teamId) =>
        t.role !== 'parent' || t.id === u.id || viewerTeams.has(teamId) || u.role === 'staff',
    )
    .map(world.teamSummary);

  const withContact = hasBaseballCard(t.role) ? world.cardFor(t.id, u) : null;
  let card = null;
  let contact: SharedContact = {};
  if (withContact) {
    const { contact: shared, ...face } = withContact;
    card = face;
    // Profiles show contacts only to the audiences the athlete chose; teens never get any.
    if (t.id !== u.id && (u.role === 'parent' || u.role === 'recruiter')) contact = shared;
  }
  if (u.role === 'teen') contact = {};
  return {
    kind: 'person',
    user: fx.summaryOf(t),
    teams,
    communities: profileCommunities(world, t, u),
    card,
    contact,
  };
};

// Settings -----------------------------------------------------------------------------------------

export const cardOf = (world: MockWorld, athleteId: string) =>
  world.cards.find((c) => c.face.athleteId === athleteId);

export const settingsFor = (world: MockWorld, u: MockUser): MySettings => {
  const holder = hasBaseballCard(u.role);
  const card = holder ? cardOf(world, u.id) : undefined;
  const published = !!card?.visibility.published;
  const reason = !canBeOpenToRecruiting(u.role)
    ? u.role === 'teen'
      ? 'Teens can’t be open to recruiting.'
      : 'Only athletes can be open to recruiting.'
    : !published
      ? 'Publish your Baseball Card first.'
      : null;
  return {
    contact: card ? card.contact : null,
    familiesSee: card ? card.visibility.familiesSee : null,
    recruitersSee: card ? card.visibility.recruitersSee : null,
    cardPublished: published,
    openToRecruiting: {
      on: !!card?.visibility.openToRecruiting,
      allowed: reason === null,
      reason,
    },
    searchable: holder
      ? world.communities.flatMap((c) => {
          if (c.kind !== 'interest' || !c.official || c.moderation !== 'approved') return [];
          const m = c.members.find((x) => x.userId === u.id);
          return m
            ? [{ community: { id: c.id, name: c.name }, on: m.recruiterSearchOptIn ?? false }]
            : [];
        })
      : [],
  };
};

// The athlete's card ---------------------------------------------------------------------------------

export const myCardState = (world: MockWorld, u: MockUser): MyCardState => {
  const card = cardOf(world, u.id);
  return {
    card: card
      ? {
          ...world.cardFace(card),
          contact: card.contact,
          visibility: card.visibility,
          isCurrent: true,
          updatedAt: world.profiles.updatedAt.get(u.id) ?? SEEDED,
        }
      : null,
    draft: world.profiles.drafts.get(u.id) ?? null,
    pendingResume: world.profiles.resumes.get(u.id) ?? null,
  };
};

/**
 * Publish the draft: it becomes the card everyone allowed to see it sees, and a new version in
 * the season's history. Only card holders get here, so a child never has a published card.
 * Returns an error message, or null.
 */
export const publishCard = (world: MockWorld, u: MockUser, now: string): string | null => {
  if (!hasBaseballCard(u.role)) return 'Only athletes have a Baseball Card.';
  const existing = cardOf(world, u.id);
  const draft = world.profiles.drafts.get(u.id) ?? {};
  const face = existing?.face as Record<string, unknown> | undefined;
  const base = face
    ? Object.fromEntries(Object.keys(CardFields.shape).map((k) => [k, face[k]]))
    : { firstName: u.firstName, lastName: u.lastName, skills: [] };
  const parsed = CardFields.safeParse({
    jerseyNumber: null,
    position: null,
    hometown: null,
    city: null,
    region: null,
    experience: null,
    lookingFor: null,
    ...base,
    ...draft,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues[0];
    return missing?.message.startsWith('Add')
      ? missing.message
      : `Check ${String(missing?.path[0] ?? 'your card')} before publishing.`;
  }
  const card: MockCard = existing ?? {
    face: {
      id: world.newId(),
      athleteId: u.id,
      season: 2026,
      teamId: world.teamIdsOf(u.id)[0] ?? null,
      photoUrl: null,
      ...parsed.data,
    },
    contact: { email: u.email, phone: null, linkedinUrl: null },
    visibility: {
      published: false,
      openToRecruiting: false,
      familiesSee: { email: true, phone: false, linkedin: false },
      recruitersSee: { email: true, phone: false, linkedin: false },
    },
  };
  if (!existing) world.cards.push(card);
  Object.assign(card.face, parsed.data);
  card.visibility.published = true;
  world.profiles.drafts.delete(u.id);
  world.profiles.updatedAt.set(u.id, now);
  const versions = world.profiles.history.get(u.id) ?? [];
  const season = versions.filter((v) => v.season === card.face.season);
  versions.push({
    version: season.length + 1,
    season: card.face.season,
    publishedAt: now,
    face: structuredClone(card.face),
  });
  world.profiles.history.set(u.id, versions);
  return null;
};

export const historyFor = (world: MockWorld, u: MockUser): CardVersion[] =>
  [...(world.profiles.history.get(u.id) ?? [])].reverse().map((v) => ({
    version: v.version,
    season: v.season,
    publishedAt: v.publishedAt,
    face: world.cardFace({ face: v.face } as MockCard),
  }));

// Resume extraction (mock) -----------------------------------------------------------------------

const LABELS: Record<string, (typeof EXTRACTABLE_CARD_FIELDS)[number]> = {
  position: 'position',
  jersey: 'jerseyNumber',
  number: 'jerseyNumber',
  class: 'classYear',
  'class year': 'classYear',
  'grad year': 'classYear',
  major: 'major',
  hometown: 'hometown',
  city: 'city',
  experience: 'experience',
  skills: 'skills',
  'looking for': 'lookingFor',
  objective: 'lookingFor',
};

/** What the mock reads from a file with no text: a believable resume. */
const SAMPLE = [
  'Position: Midfielder',
  'Major: Economics',
  'Class: 2027',
  'Experience: Investment club treasurer; summer intern at a credit union.',
  'Skills: Excel, Financial modeling, Spanish',
  'Looking for: Finance internship, summer 2027',
].join('\n');

/** Control characters and markup brackets out; plain text only. */
const clean = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Stand-in for the real extractor. The text is untrusted data: it is only matched against known
 * `Label: value` lines, every value is validated against the card's fixed schema (anything that
 * doesn't fit is dropped), and no addresses or birthdates are read. A file named `*fail*` fails,
 * so the type-it-yourself path can be tried.
 */
export const extractResume = (
  world: MockWorld,
  fileName: string,
  text: string | undefined,
  now: string,
): ResumeExtraction => {
  const failed = /fail/i.test(fileName);
  const source = failed ? '' : (text ?? SAMPLE);
  const fields: Record<string, unknown> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z ]{2,20}?)\s*:\s*(.+)$/.exec(line);
    const key = match && LABELS[match[1]!.toLowerCase()];
    if (!key || key in fields) continue;
    const raw = clean(match[2]!);
    const value =
      key === 'classYear'
        ? Number(/\b(19|20)\d{2}\b/.exec(raw)?.[0])
        : key === 'skills'
          ? raw.split(/[,;]/).map(clean).filter(Boolean).slice(0, 20)
          : key === 'jerseyNumber'
            ? raw.replace(/^#/, '')
            : raw;
    const ok = CardFields.shape[key].safeParse(value);
    if (ok.success) fields[key] = ok.data;
  }
  const keys = EXTRACTABLE_CARD_FIELDS.filter((k) => k in fields);
  return {
    id: world.newId(),
    status: 'unconfirmed',
    fileName: clean(fileName),
    failed: keys.length === 0,
    fields: fields as ResumeExtraction['fields'],
    needsReview: [...keys],
    createdAt: now,
  };
};
