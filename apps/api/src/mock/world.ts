import {
  type CalendarEvent,
  canJoinCommunity,
  type CardFace,
  type CardWithContact,
  type Community,
  type ContactSharing,
  type FeatureFlags,
  type IdentitySearchLogEntry,
  type Me,
  type Post,
  type RecruiterList,
  type RecruiterListDetail,
  type SharedContact,
  type StaffCommunity,
  type TeamSummary,
} from '@team-impact/contracts';
import * as fx from './fixtures';
import type { MockCard, MockCommunity, MockList, MockUser } from './fixtures';

/**
 * The mock API's state and visibility rules. Each test or server gets its own copy, so writes
 * (sign-in, join requests, staff actions) never leak between them.
 *
 * The rules mirror CLAUDE.md's hard product rules so the clients are built against the right
 * shapes from day one; the real access layer replaces this.
 */
export class MockWorld {
  readonly users = structuredClone(fx.ALL_USERS);
  readonly communities = structuredClone(fx.COMMUNITIES);
  readonly posts = structuredClone(fx.POSTS);
  readonly events = structuredClone(fx.EVENTS);
  readonly cards = structuredClone(fx.CARDS);
  readonly lists = structuredClone(fx.LISTS);
  readonly tickets = structuredClone(fx.TICKETS);
  readonly joinRequests = structuredClone(fx.JOIN_REQUESTS);
  readonly teamMembers = structuredClone(fx.TEAM_MEMBERS);
  readonly identitySearches: IdentitySearchLogEntry[] = [];
  private nextId = 5000;

  constructor(readonly flags: FeatureFlags) {}

  newId = () => fx.id(this.nextId++);

  user = (userId: string) => this.users.find((u) => u.id === userId);

  teamIdsOf = (userId: string) =>
    this.teamMembers.filter((m) => m.userId === userId).map((m) => m.teamId);

  me = (u: MockUser): Me => ({
    ...fx.summaryOf(u),
    email: u.email,
    teamIds: this.teamIdsOf(u.id),
    notificationPrefs: {
      approvals: true,
      replies: true,
      events: true,
      announcements: true,
      emailDigest: false,
    },
    createdAt: u.createdAt,
  });

  teamSummary = (teamId: string): TeamSummary => {
    const team = fx.TEAMS.find((t) => t.id === teamId)!;
    const { id, name, college, sport, gender, division, color, logoUrl } = team;
    return { id, name, college, sport, gender, division, color, logoUrl };
  };

  // Communities ----------------------------------------------------------------------------------

  /** Membership as the member sees it; null if `u` isn't in it. */
  private membership = (c: MockCommunity, u: MockUser) => {
    if (c.kind === 'team') {
      const m = this.teamMembers.find((tm) => tm.teamId === c.teamId && tm.userId === u.id);
      return m ? { joinedAt: m.joinedAt } : null;
    }
    // Everyone but recruiters belongs to Team Impact's community; recruiters only read it.
    if (c.kind === 'team_impact') return u.role === 'recruiter' ? null : { joinedAt: u.createdAt };
    const m = c.members.find((cm) => cm.userId === u.id);
    return m
      ? { joinedAt: m.joinedAt, recruiterSearchOptIn: m.recruiterSearchOptIn ?? false }
      : null;
  };

  private memberCount = (c: MockCommunity) => {
    if (c.kind === 'team') return this.teamMembers.filter((m) => m.teamId === c.teamId).length;
    if (c.kind === 'team_impact') return this.users.filter((u) => u.role !== 'recruiter').length;
    return c.members.length;
  };

  /** Whether `u` may see the community exists: listed, openable, its name shown. */
  canSeeCommunity = (c: MockCommunity, u: MockUser): boolean => {
    if (c.kind === 'medical' && !this.flags.medicalCommunities) return false;
    if (c.moderation === 'removed') return false;
    const creator = 'createdById' in c && c.createdById === u.id;
    if (c.moderation !== 'approved' && u.role !== 'staff' && !creator) return false;
    if (u.role === 'staff') return true;
    switch (c.kind) {
      case 'team':
        return this.membership(c, u) !== null;
      case 'team_impact':
        return true;
      case 'medical':
        // Teens and recruiters never see medical communities, not even their names.
        return canJoinCommunity(u.role, 'medical');
      case 'interest':
        return u.role === 'recruiter' ? c.official : true;
    }
  };

  /** Whose posts and events reach `u`'s feed: their communities, plus what recruiters may read. */
  readsCommunity = (c: MockCommunity, u: MockUser): boolean => {
    if (!this.canSeeCommunity(c, u)) return false;
    if (this.membership(c, u)) return true;
    if (u.role !== 'recruiter') return false;
    return c.kind === 'team_impact' || (c.kind === 'interest' && c.official);
  };

  community = (c: MockCommunity, u: MockUser): Community => {
    const base = {
      id: c.id,
      name: c.name,
      about: c.about,
      memberCount: this.memberCount(c),
      moderation: c.moderation,
      createdAt: c.createdAt,
    };
    const mine = this.membership(c, u);
    const joined = mine && { joinedAt: mine.joinedAt };
    switch (c.kind) {
      case 'team':
        return { ...base, kind: 'team', teamId: c.teamId, myMembership: joined };
      case 'team_impact':
        return { ...base, kind: 'team_impact', myMembership: joined };
      case 'medical':
        return {
          ...base,
          kind: 'medical',
          createdBy: fx.summaryOf(this.user(c.createdById)!),
          myMembership: joined,
        };
      case 'interest':
        return {
          ...base,
          kind: 'interest',
          createdBy: fx.summaryOf(this.user(c.createdById)!),
          official: c.official,
          myMembership: mine && {
            joinedAt: mine.joinedAt,
            recruiterSearchOptIn: mine.recruiterSearchOptIn ?? false,
          },
        };
    }
  };

  staffCommunity = (c: MockCommunity, staff: MockUser): StaffCommunity => ({
    community: this.community(c, staff),
    recruiterSearchOptInCount:
      c.kind === 'interest' ? c.members.filter((m) => m.recruiterSearchOptIn).length : null,
  });

  /** Ranking for the pilot: team first, then other communities, then Team Impact; newest first. */
  private static WEIGHT = { team: 0, interest: 1, medical: 1, team_impact: 2 } as const;

  /**
   * Communities whose posts and events reach `u`'s home feed and events list. Medical communities
   * never do: membership is never a ranking input outside that community's own feed (PRD §5).
   */
  private homeCommunities = (u: MockUser) =>
    new Map(
      this.communities
        .filter((c) => c.kind !== 'medical' && this.readsCommunity(c, u))
        .map((c) => [c.id, c]),
    );

  feed = (u: MockUser): Post[] => {
    const readable = this.homeCommunities(u);
    return this.posts
      .filter((p) => readable.has(p.communityId))
      .filter((p) => p.moderation === 'approved' || p.authorId === u.id)
      .sort(
        (a, b) =>
          MockWorld.WEIGHT[readable.get(a.communityId)!.kind] -
            MockWorld.WEIGHT[readable.get(b.communityId)!.kind] ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .map((p) => {
        const c = readable.get(p.communityId)!;
        const { authorId, communityId, opportunity, ...rest } = p;
        void authorId;
        void communityId;
        const shared = {
          ...rest,
          author: fx.summaryOf(this.user(p.authorId)!),
          community: { id: c.id, name: c.name, kind: c.kind },
          likedByMe: false,
        };
        return p.kind === 'opportunity'
          ? { ...shared, kind: 'opportunity', opportunity: opportunity! }
          : { ...shared, kind: p.kind };
      });
  };

  eventsFor = (u: MockUser): CalendarEvent[] => {
    const readable = this.homeCommunities(u);
    return this.events
      .filter((e) => readable.has(e.communityId) && e.moderation === 'approved')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(({ hostId, communityId, ...e }) => {
        const c = readable.get(communityId)!;
        return {
          ...e,
          host: fx.summaryOf(this.user(hostId)!),
          community: { id: c.id, name: c.name, kind: c.kind },
          myRsvp: null,
        };
      });
  };

  // Cards ----------------------------------------------------------------------------------------

  cardFace = (card: MockCard): CardFace => {
    const { teamId, ...face } = card.face;
    return { ...face, team: teamId ? this.teamSummary(teamId) : null };
  };

  /** On the employer portal at all: a published card, open to recruiting, of an athlete. */
  recruiterCanSee = (card: MockCard) => {
    const owner = this.user(card.face.athleteId);
    return (
      card.visibility.published &&
      card.visibility.openToRecruiting &&
      (owner?.role === 'athlete' || owner?.role === 'alumni_athlete')
    );
  };

  private static share = (
    contact: MockCard['contact'],
    sharing: ContactSharing,
  ): SharedContact => ({
    ...(sharing.email && contact.email ? { email: contact.email } : {}),
    ...(sharing.phone && contact.phone ? { phone: contact.phone } : {}),
    ...(sharing.linkedin && contact.linkedinUrl ? { linkedinUrl: contact.linkedinUrl } : {}),
  });

  /** A card as `u` may see it, with only the contacts shared with them; null if they can't. */
  cardFor = (athleteId: string, u: MockUser): CardWithContact | null => {
    const card = this.cards.find((c) => c.face.athleteId === athleteId);
    if (!card) return null;
    const face = this.cardFace(card);
    const none: ContactSharing = { email: false, phone: false, linkedin: false };
    if (u.id === athleteId) {
      return {
        ...face,
        contact: MockWorld.share(card.contact, { email: true, phone: true, linkedin: true }),
      };
    }
    if (!card.visibility.published) return null;
    if (u.role === 'recruiter') {
      return this.recruiterCanSee(card)
        ? { ...face, contact: MockWorld.share(card.contact, card.visibility.recruitersSee) }
        : null;
    }
    if (u.role === 'staff') return { ...face, contact: {} };
    const sameTeam = card.face.teamId !== null && this.teamIdsOf(u.id).includes(card.face.teamId);
    if (!sameTeam) return null;
    // Teens never see athletes' contact details; approved parents see the family set.
    const sharing = u.role === 'parent' ? card.visibility.familiesSee : none;
    return { ...face, contact: MockWorld.share(card.contact, sharing) };
  };

  // Lists ----------------------------------------------------------------------------------------

  listsFor = (u: MockUser) =>
    this.lists.filter(
      (l) => l.companyId === u.companyId && (l.ownerId === u.id || l.sharedWithIds.includes(u.id)),
    );

  private visibleEntries = (l: MockList) =>
    l.entries.filter((e) => {
      const card = this.cards.find((c) => c.face.athleteId === e.athleteId);
      return card && this.recruiterCanSee(card);
    });

  list = (l: MockList): RecruiterList => ({
    id: l.id,
    companyId: l.companyId,
    name: l.name,
    color: l.color,
    note: l.note,
    owner: fx.summaryOf(this.user(l.ownerId)!),
    sharedWith: l.sharedWithIds.map((uid) => fx.summaryOf(this.user(uid)!)),
    athleteCount: this.visibleEntries(l).length,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  });

  listDetail = (l: MockList, u: MockUser): RecruiterListDetail => ({
    ...this.list(l),
    entries: this.visibleEntries(l).map((e) => ({
      card: this.cardFor(e.athleteId, u)!,
      addedBy: fx.summaryOf(this.user(e.addedById)!),
      addedAt: e.addedAt,
      latestNote:
        fx.NOTES.filter((n) => n.athleteId === e.athleteId)
          .filter((n) => this.user(n.author.id)?.companyId === u.companyId)
          .at(-1) ?? null,
    })),
  });
}

export type { MockUser };
