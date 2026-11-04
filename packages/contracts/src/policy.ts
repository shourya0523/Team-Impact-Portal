import { canJoinCommunity, type CommunityKind } from './communities';
import type { ModerationStatus } from './moderation';
import type { Role } from './roles';

/**
 * Who can see and do what (PRD v2 §2, §5, §6), in one place. `can(actor, action, target)` is a
 * pure function of plain facts: callers (the mock world today, the database routes later) look up
 * roles, team links, blocks and card settings and pass them in, so the rules never depend on where
 * the data lives. Clients may call it to hide what they can't do; the API still enforces it.
 */

/** The signed-in account asking. Children under 13 never log in, so are never an actor. */
export interface Actor {
  id: string;
  role: Role;
  teamIds: readonly string[];
  /** Recruiters only. */
  companyId?: string | null;
}

/** What decides whether a card reaches the employer portal at all. */
export interface CardFacts {
  athleteId: string;
  ownerRole: Role;
  teamId: string | null;
  published: boolean;
  openToRecruiting: boolean;
  ownerSuspended: boolean;
}

export interface CommunityFacts {
  kind: CommunityKind;
  /** Interest communities only. */
  official?: boolean;
  private?: boolean;
  moderation: ModerationStatus;
  createdById?: string;
  /** The actor belongs to it (for a team community: is on the team). */
  isMember: boolean;
  /** The switch that hides medical communities everywhere (PRD §11). */
  medicalEnabled: boolean;
}

/** A post, comment or event, as seen by the actor. */
export interface ContentFacts {
  authorId: string;
  /** Official Team Impact content can't be blocked. */
  official?: boolean;
  /** Either the actor or the author blocked the other. */
  blocked: boolean;
  reportedByActor: boolean;
  authorSuspended: boolean;
}

interface Targets {
  /** An under-13 profile, run by `parentId`. */
  'child.read': { parentId: string; teamId: string | null };
  'teen.read': { id: string; teamIds: readonly string[] };
  /** Any other account's plain profile. */
  'person.read': {
    id: string;
    role: Role;
    teamIds: readonly string[];
    companyId?: string | null;
    card: CardFacts | null;
    /** Both are members of an open, approved interest community. */
    sharesOpenCommunity: boolean;
  };
  'card.read': CardFacts;
  /** Any of the card's contact details. */
  'card.contacts': CardFacts;
  'community.see': CommunityFacts;
  'community.read': CommunityFacts;
  'community.join': { kind: CommunityKind };
  'community.members': CommunityFacts;
  /** One person appearing in a community's member list. */
  'community.listMember': {
    kind: CommunityKind;
    memberId: string;
    memberRole: Role;
    blocked: boolean;
  };
  'team.roster': { teamId: string };
  'team.manage': { teamId: string };
  'team.familyContacts': { teamId: string };
  'content.read': ContentFacts;
  'content.reply': ContentFacts;
}

export type Action = keyof Targets;
export type Target<A extends Action> = Targets[A];

const onTeam = (a: Actor, teamId: string | null) => teamId !== null && a.teamIds.includes(teamId);
const sharesTeam = (a: Actor, teamIds: readonly string[]) => teamIds.some((t) => onTeam(a, t));

/** On the employer portal at all: a published card, open to recruiting, of an athlete. */
export const recruiterVisible = (card: CardFacts) =>
  card.published &&
  card.openToRecruiting &&
  !card.ownerSuspended &&
  (card.ownerRole === 'athlete' || card.ownerRole === 'alumni_athlete');

/** Whose contact choices apply to the actor: all of them, a chosen set, or none. */
export type ContactAudience = 'owner' | 'recruiters' | 'families' | 'none';

/** Teens never see contacts; approved parents see the family set, recruiters their own set. */
export const contactAudience = (a: Actor, card: CardFacts): ContactAudience => {
  if (a.id === card.athleteId) return 'owner';
  if (!can(a, 'card.read', card)) return 'none';
  if (a.role === 'recruiter') return 'recruiters';
  if (a.role === 'parent') return 'families';
  return 'none';
};

/** Why a member list is closed to the actor, or null when it's open. */
export type MembersDenial = 'recruiter' | 'medical' | 'team_impact' | 'private' | 'not_member';

export const membersDenial = (a: Actor, c: CommunityFacts): MembersDenial | null => {
  if (a.role === 'recruiter') return 'recruiter';
  if (c.kind === 'medical') return 'medical';
  if (c.kind === 'team_impact') return 'team_impact';
  if (!can(a, 'community.read', c))
    return c.kind === 'interest' && c.private ? 'private' : 'not_member';
  return null;
};

const canSeeCommunity = (a: Actor, c: CommunityFacts) => {
  if (c.kind === 'medical' && !c.medicalEnabled) return false;
  if (c.moderation === 'removed') return false;
  const creator = c.createdById === a.id;
  if (c.moderation !== 'approved' && a.role !== 'staff' && !creator) return false;
  if (a.role === 'staff') return true;
  switch (c.kind) {
    case 'team':
      return c.isMember;
    case 'team_impact':
      return true;
    case 'medical':
      // Teens and recruiters never see medical communities, not even their names.
      return canJoinCommunity(a.role, 'medical');
    case 'interest':
      return a.role === 'recruiter' ? !!c.official : true;
  }
};

const canReadContent = (a: Actor, x: ContentFacts) =>
  !x.reportedByActor && !(!x.official && x.blocked) && !x.authorSuspended;

const RULES: { [A in Action]: (a: Actor, t: Targets[A]) => boolean } = {
  // Team and family only: the parent, and accounts on the child's team. Recruiters never.
  'child.read': (a, t) => a.role !== 'recruiter' && (a.id === t.parentId || onTeam(a, t.teamId)),

  // Their own team (and themselves); recruiters never.
  'teen.read': (a, t) => a.id === t.id || (a.role !== 'recruiter' && sharesTeam(a, t.teamIds)),

  'person.read': (a, t) => {
    if (t.role === 'teen') return RULES['teen.read'](a, t);
    if (t.id === a.id || a.role === 'staff' || t.role === 'staff') return true;
    if (a.role === 'recruiter') {
      // Athletes without open-to-recruiting don't exist on the employer side; colleagues do.
      if (t.role === 'recruiter') return !!a.companyId && t.companyId === a.companyId;
      return !!t.card && recruiterVisible(t.card);
    }
    if (t.role === 'recruiter') return false;
    if (sharesTeam(a, t.teamIds)) return true;
    if (t.role === 'alumni_athlete' || t.role === 'alumni_mentor') return true;
    return t.sharesOpenCommunity;
  },

  'card.read': (a, card) => {
    if (a.id === card.athleteId) return true;
    if (!card.published) return false;
    if (a.role === 'recruiter') return recruiterVisible(card);
    if (a.role === 'staff') return true;
    return onTeam(a, card.teamId);
  },

  'card.contacts': (a, card) => contactAudience(a, card) !== 'none',

  'community.see': canSeeCommunity,

  // Whose posts and events reach the feed: members, plus what recruiters may read.
  'community.read': (a, c) =>
    canSeeCommunity(a, c) &&
    (c.isMember ||
      (a.role === 'recruiter' &&
        (c.kind === 'team_impact' || (c.kind === 'interest' && !!c.official)))),

  'community.join': (a, t) => canJoinCommunity(a.role, t.kind),

  'community.members': (a, c) => membersDenial(a, c) === null,

  // A teen's name only appears in their own team's community; blocks cut both ways.
  'community.listMember': (a, t) =>
    (t.memberRole !== 'teen' || t.kind === 'team') && (t.memberId === a.id || !t.blocked),

  'team.roster': (a, t) => a.role === 'staff' || onTeam(a, t.teamId),

  // Approve, remove, edit, make codes and invite coaches.
  'team.manage': (a, t) => a.role === 'staff' || (a.role === 'coach' && onTeam(a, t.teamId)),

  // The team's own coaches only. Staff manage the team but don't need a family's phone.
  'team.familyContacts': (a, t) => a.role === 'coach' && onTeam(a, t.teamId),

  'content.read': canReadContent,

  // Blocked users can't reply to what they can't read.
  'content.reply': canReadContent,
};

export const can = <A extends Action>(actor: Actor, action: A, target: Targets[A]): boolean =>
  RULES[action](actor, target);
