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
  type NotificationPrefs,
  type Post,
  type RecruiterList,
  type RecruiterListDetail,
  type SharedContact,
  type StaffCommunity,
  type TeamSummary,
} from '@team-impact/contracts';
import { COMMENTS, DEFAULT_PREFS } from './activity';
import type { MockComment, MockDevice, MockNotification, MockPush, MockRsvp } from './activity';
import * as fx from './fixtures';
import { rank } from './feed';
import type { MockCard, MockCommunity, MockEvent, MockList, MockPost, MockUser } from './fixtures';
import { createProfileState } from './profiles';
import { newSignupState } from './signup';
import { isSuspended, newStaffToolsState } from './staff-tools';
import {
  initialCoachInvites,
  initialQrCodes,
  type MockChild,
  type MockCoachInvite,
  type MockQrCode,
} from './team';
import { hiddenFor, type MockBlock, type MockReport } from './safety';

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
  /** Child profiles parents run: never users, never accounts. They leave with their parent. */
  readonly children: MockChild[] = structuredClone(fx.CHILDREN);
  /** Recruiters waiting on staff (`./signup.ts`). */
  readonly signup = newSignupState();
  // Posting, events and notifications (see activity.ts).
  readonly comments: MockComment[] = structuredClone(COMMENTS);
  readonly rallies: { postId: string; userId: string }[] = [];
  readonly rsvps: MockRsvp[] = [];
  readonly notifications: MockNotification[] = [];
  readonly notificationPrefs = new Map<string, NotificationPrefs>();
  /** Phones registered for push, and the pushes sent to them (nothing leaves the mock). */
  readonly devices: MockDevice[] = [];
  readonly pushOutbox: MockPush[] = [];
  /** Children, card drafts, pending resumes and card history (profiles area). */
  readonly profiles = createProfileState(this.cards);
  /** Coaches edit their team and a first coach makes it live, so each world has its own copy. */
  readonly teams = structuredClone(fx.TEAMS);
  /** Team QR codes and coach invites (`./team.ts`). */
  readonly qrCodes: MockQrCode[] = initialQrCodes();
  readonly coachInvites: MockCoachInvite[] = initialCoachInvites();
  // Staff-managed records (safety area), copied so staff tools can write to them.
  readonly colleges = structuredClone(fx.COLLEGES);
  readonly companies = structuredClone(fx.COMPANIES);
  readonly notes = structuredClone(fx.NOTES);
  // Trust and safety (./safety.ts): reports hide items for their reporter; blocks cut both ways.
  readonly reports: MockReport[] = [];
  readonly blocks: MockBlock[] = [];
  /** Suspended accounts and the moderation action log (`./staff-tools.ts`). */
  readonly staffTools = newStaffToolsState();
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
    notificationPrefs: this.notificationPrefs.get(u.id) ?? DEFAULT_PREFS,
    createdAt: u.createdAt,
  });

  teamSummary = (teamId: string): TeamSummary => {
    const team = this.teams.find((t) => t.id === teamId)!;
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
        return { ...base, kind: 'medical', ...this.userMade(c, u), myMembership: joined };
      case 'interest':
        return {
          ...base,
          kind: 'interest',
          ...this.userMade(c, u),
          official: c.official,
          myMembership: mine && {
            joinedAt: mine.joinedAt,
            recruiterSearchOptIn: mine.recruiterSearchOptIn ?? false,
          },
        };
    }
  };

  private userMade = (c: MockCommunity & { createdById: string }, u: MockUser) => {
    if (c.kind !== 'medical' && c.kind !== 'interest') throw new Error('not user-made');
    const request = c.requests.find((r) => r.userId === u.id);
    return {
      createdBy: fx.summaryOf(this.user(c.createdById)!),
      private: c.private,
      myJoinRequest: request ? { requestedAt: request.requestedAt } : null,
    };
  };

  staffCommunity = (c: MockCommunity, staff: MockUser): StaffCommunity => ({
    community: this.community(c, staff),
    recruiterSearchOptInCount:
      c.kind === 'interest' ? c.members.filter((m) => m.recruiterSearchOptIn).length : null,
  });

  /**
   * Communities whose posts and events reach `u`'s home feed and events list: every one they read,
   * medical and private ones included (PRD v2.3). Private ones only ever reach members.
   */
  private homeCommunities = (u: MockUser) =>
    new Map(this.communities.filter((c) => this.readsCommunity(c, u)).map((c) => [c.id, c]));

  feed = (u: MockUser): Post[] => this.postsIn(this.homeCommunities(u), u);

  /** One community's own feed, for its members (and recruiters, in official ones). */
  communityFeed = (c: MockCommunity, u: MockUser): Post[] =>
    this.readsCommunity(c, u) ? this.postsIn(new Map([[c.id, c]]), u) : [];

  /**
   * A teen's name only ever shows in the community of a team they're on (CLAUDE.md hard rules):
   * not another team's, and not their old team's once a coach removes them. Posting and
   * commenting already enforce this; reads check again so nothing that slipped in can leak.
   */
  teenOutsideTeam = (authorId: string, c: MockCommunity) =>
    this.user(authorId)?.role === 'teen' &&
    (c.kind !== 'team' || !this.teamIdsOf(authorId).includes(c.teamId));

  /**
   * Whether `u` sees post `p` in `c`, a community they read: approved, or their own while it waits
   * for review ("Waiting for review"); never a teen's outside their team; never one a block or
   * their own report hides.
   */
  private canSeePost = (p: MockPost, c: MockCommunity, u: MockUser) =>
    (p.moderation === 'approved' || (p.moderation === 'in_review' && p.authorId === u.id)) &&
    !this.teenOutsideTeam(p.authorId, c) &&
    !hiddenFor(this, u, p);

  /**
   * Approved comment counts and `u`'s rallies for a set of posts, one pass over each list rather
   * than one per post.
   *
   * Kept simple on purpose: the mock stores comments and rallies as flat arrays with no index by
   * post, so this reads every comment and rally in the world, not just those on `posts`. Fine at
   * fixture size; an index would have to be kept in step with every write. The real API should
   * only touch these posts' rows: one grouped count per post (`comments_post_created_idx`) and
   * the viewer's rallies on them.
   */
  private engagement = (
    posts: MockPost[],
    communityOf: (p: MockPost) => MockCommunity,
    u: MockUser,
  ) => {
    const inPost = new Map(posts.map((p) => [p.id, communityOf(p)]));
    const commentCounts = new Map<string, number>();
    for (const k of this.comments) {
      const c = inPost.get(k.postId);
      if (!c || k.moderation !== 'approved' || this.teenOutsideTeam(k.authorId, c)) continue;
      commentCounts.set(k.postId, (commentCounts.get(k.postId) ?? 0) + 1);
    }
    const rallied = new Set(
      this.rallies.filter((r) => r.userId === u.id && inPost.has(r.postId)).map((r) => r.postId),
    );
    return { commentCounts, rallied };
  };

  /** A stored post in the shape the API returns. */
  private toPost = (
    p: MockPost,
    c: MockCommunity,
    { commentCounts, rallied }: ReturnType<MockWorld['engagement']>,
  ): Post => {
    const { authorId, communityId, opportunity, ...rest } = p;
    void authorId;
    void communityId;
    const shared = {
      ...rest,
      author: fx.summaryOf(this.user(p.authorId)!),
      community: { id: c.id, name: c.name, kind: c.kind },
      imageUrl: p.imageUrl ?? null,
      commentCount: commentCounts.get(p.id) ?? 0,
      likedByMe: rallied.has(p.id),
    };
    return p.kind === 'opportunity'
      ? { ...shared, kind: 'opportunity', opportunity: opportunity! }
      : { ...shared, kind: p.kind };
  };

  /** The posts `u` sees in `readable` (communities they read), in feed order (`./feed.ts`). */
  postsIn = (readable: Map<string, MockCommunity>, u: MockUser): Post[] => {
    const communityOf = (p: MockPost) => readable.get(p.communityId)!;
    const visible = this.posts.filter(
      (p) => readable.has(p.communityId) && this.canSeePost(p, communityOf(p), u),
    );
    const counts = this.engagement(visible, communityOf, u);
    return rank(visible, communityOf).map((p) => this.toPost(p, communityOf(p), counts));
  };

  /** One post as `u` reads it in `c`, or undefined if they can't. Callers check `u` reads `c`. */
  postView = (p: MockPost, c: MockCommunity, u: MockUser): Post | undefined =>
    p.communityId === c.id && this.canSeePost(p, c, u)
      ? this.toPost(
          p,
          c,
          this.engagement([p], () => c, u),
        )
      : undefined;

  /**
   * Join an interest or medical community. Team communities follow the team and everyone is
   * already in Team Impact's. Returns an error message, or null on success.
   */
  join = (c: MockCommunity, u: MockUser): string | null => {
    if (c.kind !== 'interest' && c.kind !== 'medical')
      return 'This community can’t be joined directly';
    if (!canJoinCommunity(u.role, c.kind) || c.moderation !== 'approved') {
      return 'You can’t join this community';
    }
    if (c.members.some((m) => m.userId === u.id)) return null;
    if (c.private) {
      // A request the creator approves, like a team's join request.
      if (!c.requests.some((r) => r.userId === u.id)) {
        c.requests.push({ userId: u.id, requestedAt: new Date().toISOString() });
      }
      return null;
    }
    c.members.push({
      userId: u.id,
      joinedAt: new Date().toISOString(),
      recruiterSearchOptIn: false,
    });
    return null;
  };

  /** Requests waiting on a private community's creator; null if `u` isn't the creator. */
  communityJoinRequests = (c: MockCommunity, u: MockUser) => {
    if ((c.kind !== 'interest' && c.kind !== 'medical') || c.createdById !== u.id) return null;
    return c.requests.map((r) => ({
      user: fx.summaryOf(this.user(r.userId)!),
      requestedAt: r.requestedAt,
    }));
  };

  /** The creator approves or declines one request. Returns an error message, or null. */
  decideJoin = (
    c: MockCommunity,
    u: MockUser,
    userId: string,
    decision: 'approve' | 'decline',
  ): string | null => {
    if ((c.kind !== 'interest' && c.kind !== 'medical') || c.createdById !== u.id) {
      return 'Only the creator decides who joins';
    }
    const request = c.requests.find((r) => r.userId === userId);
    if (!request) return 'No such request';
    c.requests = c.requests.filter((r) => r !== request);
    if (decision === 'approve') {
      c.members.push({ userId, joinedAt: new Date().toISOString(), recruiterSearchOptIn: false });
    }
    return null;
  };

  /**
   * "Recruiters can find me through this community": official interest communities only, for
   * athletes with a published card. Returns an error message, or null on success.
   */
  setFindable = (c: MockCommunity, u: MockUser, findable: boolean): string | null => {
    const member = c.members.find((m) => m.userId === u.id);
    if (c.kind !== 'interest' || !c.official)
      return 'Only official communities can make you findable';
    if (!member) return 'Join the community first';
    const card = this.cards.find((k) => k.face.athleteId === u.id);
    if (findable && !card?.visibility.published) return 'Publish your Baseball Card first';
    member.recruiterSearchOptIn = findable;
    return null;
  };

  /** Approved events in `u`'s communities, plus their own while they wait for review. */
  eventsFor = (u: MockUser): CalendarEvent[] => {
    const readable = this.homeCommunities(u);
    return this.events
      .filter((e) => readable.has(e.communityId))
      .filter(
        (e) => e.moderation === 'approved' || (e.moderation === 'in_review' && e.hostId === u.id),
      )
      .filter((e) => !hiddenFor(this, u, { id: e.id, authorId: e.hostId }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((e) => this.calendarEvent(e, readable.get(e.communityId)!, u));
  };

  calendarEvent = (e: MockEvent, c: MockCommunity, u: MockUser): CalendarEvent => {
    const { hostId, communityId, ...rest } = e;
    void communityId;
    return {
      ...rest,
      host: fx.summaryOf(this.user(hostId)!),
      community: { id: c.id, name: c.name, kind: c.kind },
      myRsvp: this.rsvps.find((r) => r.eventId === e.id && r.userId === u.id)?.status ?? null,
    };
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
      !isSuspended(this, card.face.athleteId) &&
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
        this.notes
          .filter((n) => n.athleteId === e.athleteId)
          .filter((n) => this.user(n.author.id)?.companyId === u.companyId)
          .at(-1) ?? null,
    })),
  });
}

export type { MockUser };
