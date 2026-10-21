import { createHash, randomBytes } from 'node:crypto';
import {
  QR_SHORT_CODE_ALPHABET,
  QrShortCode,
  type CoachInvite,
  type JoinRequest,
  type QrCodeJoin,
  type QrCodeLifetime,
  type RosterChild,
  type Team,
  type TeamMember,
  type TeamQrCode,
  type TeamRoster,
  type UpdateTeamRequest,
} from '@team-impact/contracts';
import { notify } from './activity';
import { id, summaryOf, USERS, type MockUser } from './fixtures';
import { sendEmail } from './outbox';
import type { MockWorld } from './world';

/**
 * Coach team management on the mock API: approvals, the roster, removing members, QR codes, coach
 * invites and team edits. State lives on `MockWorld` so other areas (redeeming a code, accepting an
 * invite) see the same codes and invites; these helpers hold the rules.
 */

export interface MockQrCode {
  id: string;
  teamId: string;
  token: string;
  shortCode: string;
  label: string | null;
  createdById: string;
  lifetime: QrCodeLifetime;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  joins: { userId: string; joinedAt: string }[];
}

/**
 * Only a hash of the token is kept (`hashInviteToken`); the raw token goes out once, in the invite
 * email (`./outbox.ts`). `/invites/:token` hashes the link's token to find the invite.
 */
export interface MockCoachInvite {
  id: string;
  teamId: string;
  email: string;
  tokenHash: string;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** A child profile run by a parent. No login, no email, no birth date (PRD §2, data model). */
export interface MockChild {
  id: string;
  parentId: string;
  /** Null once their parent leaves the team: a child stays only with its family. */
  teamId: string | null;
  firstName: string;
  lastInitial?: string;
  age: number;
  /** The parent edits these on the child's profile. */
  bio: string | null;
  photoUrl: string | null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LIFETIME_HOURS: Record<QrCodeLifetime, number> = { tonight: 6, day: 24, week: 24 * 7 };
const INVITE_DAYS = 7;

/** Phones parents chose to give their team's coaches. Email comes from the account. */
export const PARENT_PHONES: Record<string, string> = {
  [USERS.lisa.id]: '+1 617 555 0142',
  [USERS.mark.id]: '+1 617 555 0178',
};

const SOCCER = id(201);
const LACROSSE = id(202);

const newToken = () => randomBytes(24).toString('base64url');

/** Invites store only this hash; the raw token exists only in the emailed link (data model: token_hash). */
export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** What the invite email links to: the athlete app's `/invite/[token]` screen. */
export const inviteLink = (token: string) => `teamimpact://invite/${token}`;

const newShortCode = (taken: Set<string>) => {
  for (;;) {
    const bytes = randomBytes(8);
    const code = Array.from(
      bytes,
      (b) => QR_SHORT_CODE_ALPHABET[b % QR_SHORT_CODE_ALPHABET.length],
    ).join('');
    if (!taken.has(code)) return code;
  }
};

/** Codes the clients and tests point at. Dates are relative to now so they stay valid. */
export const QR_TOKENS = {
  live: 'tufts-soccer-live-qr-2026',
  revoked: 'tufts-soccer-revoked-qr-2026',
  expired: 'tufts-soccer-expired-qr-2026',
} as const;

export const INVITE_TOKENS = {
  /** The first coach of the invited lacrosse team: no account yet. */
  lacrosse: 'invite-tufts-lacrosse-first-coach',
  /** An assistant for soccer whose invite was revoked. */
  revoked: 'invite-tufts-soccer-revoked-assistant',
  expired: 'invite-tufts-soccer-expired-assistant',
} as const;

/** A live code (the four athletes joined through it), a revoked one and an expired one. */
export const initialQrCodes = (now = Date.now()): MockQrCode[] => [
  {
    id: id(1201),
    teamId: SOCCER,
    token: QR_TOKENS.live,
    shortCode: 'JUMBQ7K4',
    label: 'Preseason meeting',
    createdById: USERS.coach.id,
    lifetime: 'week',
    expiresAt: new Date(now + 3 * DAY).toISOString(),
    revokedAt: null,
    createdAt: new Date(now - 4 * DAY).toISOString(),
    joins: [USERS.jordan, USERS.sam, USERS.riley, USERS.ava].map((u) => ({
      userId: u.id,
      joinedAt: '2026-10-02T12:00:00.000Z',
    })),
  },
  {
    id: id(1202),
    teamId: SOCCER,
    token: QR_TOKENS.revoked,
    shortCode: 'RVKD7XQ4',
    label: 'Posted by mistake',
    createdById: USERS.coach.id,
    lifetime: 'week',
    expiresAt: new Date(now + 3 * DAY).toISOString(),
    revokedAt: new Date(now - DAY).toISOString(),
    createdAt: new Date(now - 4 * DAY).toISOString(),
    joins: [],
  },
  {
    id: id(1203),
    teamId: SOCCER,
    token: QR_TOKENS.expired,
    shortCode: 'XPRD4WTN',
    label: 'Open practice',
    createdById: USERS.coach.id,
    lifetime: 'tonight',
    expiresAt: new Date(now - 2 * DAY).toISOString(),
    revokedAt: null,
    createdAt: new Date(now - 3 * DAY).toISOString(),
    joins: [],
  },
];

/** Lacrosse's first coach (invited by staff), plus a revoked and an expired soccer assistant. */
export const initialCoachInvites = (now = Date.now()): MockCoachInvite[] => [
  {
    id: id(1401),
    teamId: LACROSSE,
    email: 'pat.nguyen@tufts.edu',
    tokenHash: hashInviteToken(INVITE_TOKENS.lacrosse),
    invitedById: USERS.staff.id,
    expiresAt: new Date(now + 5 * DAY).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(now - 2 * DAY).toISOString(),
  },
  {
    id: id(1402),
    teamId: SOCCER,
    email: 'alex.moore@tufts.edu',
    tokenHash: hashInviteToken(INVITE_TOKENS.revoked),
    invitedById: USERS.coach.id,
    expiresAt: new Date(now + 5 * DAY).toISOString(),
    acceptedAt: null,
    revokedAt: new Date(now - DAY).toISOString(),
    createdAt: new Date(now - 2 * DAY).toISOString(),
  },
  {
    id: id(1403),
    teamId: SOCCER,
    email: 'jamie.cole@tufts.edu',
    tokenHash: hashInviteToken(INVITE_TOKENS.expired),
    invitedById: USERS.coach.id,
    expiresAt: new Date(now - DAY).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(now - 8 * DAY).toISOString(),
  },
];

// Who may do what ---------------------------------------------------------------------------------

export const isCoachOf = (world: MockWorld, u: MockUser, teamId: string) =>
  u.role === 'coach' && world.teamIdsOf(u.id).includes(teamId);

/** Approve, remove, edit, make codes and invite coaches: the team's coaches, and staff. */
export const canManageTeam = (world: MockWorld, u: MockUser, teamId: string) =>
  u.role === 'staff' || isCoachOf(world, u, teamId);

/** The roster is for the team itself and staff; everyone else gets a 404. */
export const canSeeRoster = (world: MockWorld, u: MockUser, teamId: string) =>
  u.role === 'staff' || world.teamIdsOf(u.id).includes(teamId);

// Teams -------------------------------------------------------------------------------------------

export const team = (world: MockWorld, teamId: string): Team | null => {
  const t = world.teams.find((x) => x.id === teamId);
  return t
    ? { ...t, memberCount: world.teamMembers.filter((m) => m.teamId === teamId).length }
    : null;
};

export const updateTeam = (world: MockWorld, teamId: string, edit: UpdateTeamRequest) => {
  const t = world.teams.find((x) => x.id === teamId);
  if (!t) return null;
  if (edit.name !== undefined) t.name = edit.name;
  if (edit.color !== undefined) t.color = edit.color;
  if (edit.about !== undefined) t.about = edit.about;
  return team(world, teamId);
};

// Roster ------------------------------------------------------------------------------------------

const childrenOf = (world: MockWorld, parentId: string, teamId: string): RosterChild[] =>
  world.children
    .filter((c) => c.parentId === parentId && c.teamId === teamId)
    .map(({ id: childId, firstName }) => ({ id: childId, firstName }));

export const roster = (world: MockWorld, teamId: string, viewer: MockUser): TeamRoster | null => {
  const t = team(world, teamId);
  if (!t) return null;
  const manage = canManageTeam(world, viewer, teamId);
  // Family contact details go to the team's own coaches only. Staff manage the team but don't
  // need a family's phone; teens, athletes and other parents never get them.
  const contacts = isCoachOf(world, viewer, teamId);
  const members = world.teamMembers
    .filter((m) => m.teamId === teamId)
    .flatMap((m) => {
      const u = world.user(m.userId);
      if (!u) return [];
      const member: TeamMember = {
        user: summaryOf(u),
        joinedVia: m.joinedVia,
        joinedAt: m.joinedAt,
      };
      return [{ u, member }];
    })
    .sort((a, b) => a.u.firstName.localeCompare(b.u.firstName));
  const byRole = (role: MockUser['role']) =>
    members.filter((x) => x.u.role === role).map((x) => x.member);
  return {
    team: t,
    coaches: byRole('coach'),
    athletes: byRole('athlete'),
    teens: byRole('teen'),
    parents: members
      .filter((x) => x.u.role === 'parent')
      .map(({ u, member }) => ({
        ...member,
        children: childrenOf(world, u.id, teamId),
        contact: contacts
          ? {
              email: u.email,
              ...(PARENT_PHONES[u.id] ? { phone: PARENT_PHONES[u.id] } : {}),
            }
          : null,
      })),
    canManage: manage,
    pendingRequestCount: manage ? pendingRequests(world, teamId).length : null,
  };
};

/**
 * Takes someone off the team. A parent's under-13 children leave with them: a child's profile is
 * visible only to its team and family, so it can't stay on a team its parent has left. A team
 * always keeps at least one coach. Returns an error message, or the children who left.
 */
export const removeMember = (
  world: MockWorld,
  teamId: string,
  userId: string,
): { error: string; status: number } | { removedChildren: RosterChild[] } => {
  const index = world.teamMembers.findIndex((m) => m.teamId === teamId && m.userId === userId);
  if (index < 0) return { error: 'Not on this team', status: 404 };
  const u = world.user(userId);
  if (u?.role === 'coach') {
    const coaches = world.teamMembers.filter(
      (m) => m.teamId === teamId && world.user(m.userId)?.role === 'coach',
    );
    if (coaches.length <= 1) {
      return {
        error: 'A team always keeps at least one coach. Add another coach first.',
        status: 409,
      };
    }
  }
  world.teamMembers.splice(index, 1);
  const removedChildren = childrenOf(world, userId, teamId);
  for (const child of world.children) {
    if (child.parentId === userId && child.teamId === teamId) child.teamId = null;
  }
  return { removedChildren };
};

/** Puts `userId` on the team once; true if they were added. Every way onto a team comes here. */
export const addTeamMember = (
  world: MockWorld,
  teamId: string,
  userId: string,
  joinedVia: TeamMember['joinedVia'],
  joinedAt = new Date().toISOString(),
) => {
  if (world.teamMembers.some((m) => m.teamId === teamId && m.userId === userId)) return false;
  world.teamMembers.push({ teamId, userId, joinedVia, joinedAt });
  return true;
};

/** Live teams are in the join search and take requests, QR joins and members. */
export const isTeamLive = (world: MockWorld, teamId: string) =>
  world.teams.find((t) => t.id === teamId)?.status === 'live';

// Join requests -----------------------------------------------------------------------------------

export const pendingRequests = (world: MockWorld, teamId: string) =>
  world.joinRequests
    .filter((r) => r.teamId === teamId && r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/**
 * Applies a decision to a pending request. Approving puts the requester on the team and creates
 * the profiles of any children the parent added: rows a parent runs, never accounts.
 */
export const applyJoinDecision = (
  world: MockWorld,
  request: JoinRequest,
  decision: 'approve' | 'decline',
) => {
  const now = new Date().toISOString();
  request.status = decision === 'approve' ? 'approved' : 'declined';
  request.decidedAt = now;
  if (decision !== 'approve') return;
  addTeamMember(world, request.teamId, request.requester.id, 'join_request', now);
  if (request.role !== 'parent') return;
  for (const child of request.children ?? []) {
    world.children.push({
      id: world.newId(),
      parentId: request.requester.id,
      teamId: request.teamId,
      firstName: child.firstName,
      lastInitial: child.lastInitial,
      age: child.age,
      bio: null,
      photoUrl: null,
    });
  }
};

/** Tells the requester they're in, pointing at the team's community (if their prefs allow). */
const notifyTeamJoinApproved = (world: MockWorld, request: JoinRequest, approver: MockUser) => {
  const c = world.communities.find((x) => x.kind === 'team' && x.teamId === request.teamId);
  const t = world.teams.find((x) => x.id === request.teamId);
  if (!c || !t) return;
  notify(world, {
    userId: request.requester.id,
    kind: 'join_approved',
    actorId: approver.id,
    text: `${approver.firstName} ${approver.lastName} approved your request to join ${t.name}`,
    target: { kind: 'community', id: c.id },
    communityId: c.id,
  });
};

/** A coach of the request's team (or staff) approves or declines it, once. */
export const decideJoinRequest = (
  world: MockWorld,
  u: MockUser,
  requestId: string,
  decision: 'approve' | 'decline',
): { error: string; status: number } | { request: JoinRequest } => {
  const request = world.joinRequests.find((r) => r.id === requestId);
  if (!request) return { error: 'No such request', status: 404 };
  if (!canManageTeam(world, u, request.teamId)) {
    return { error: 'Only this team’s coaches can decide', status: 403 };
  }
  if (request.status !== 'pending') {
    return { error: 'This request was already decided', status: 409 };
  }
  applyJoinDecision(world, request, decision);
  if (decision === 'approve') notifyTeamJoinApproved(world, request, u);
  return { request };
};

// QR codes ----------------------------------------------------------------------------------------

export const qrCodeView = (world: MockWorld, code: MockQrCode): TeamQrCode => ({
  id: code.id,
  teamId: code.teamId,
  token: code.token,
  shortCode: code.shortCode,
  label: code.label,
  createdBy: summaryOf(world.user(code.createdById)!),
  lifetime: code.lifetime,
  expiresAt: code.expiresAt,
  revokedAt: code.revokedAt,
  joinCount: code.joins.length,
  createdAt: code.createdAt,
});

export const createQrCode = (
  world: MockWorld,
  u: MockUser,
  teamId: string,
  lifetime: QrCodeLifetime,
  label: string | undefined,
  now = Date.now(),
): MockQrCode => {
  const code: MockQrCode = {
    id: world.newId(),
    teamId,
    token: newToken(),
    shortCode: newShortCode(new Set(world.qrCodes.map((c) => c.shortCode))),
    label: label ?? null,
    createdById: u.id,
    lifetime,
    expiresAt: new Date(now + LIFETIME_HOURS[lifetime] * HOUR).toISOString(),
    revokedAt: null,
    createdAt: new Date(now).toISOString(),
    joins: [],
  };
  world.qrCodes.push(code);
  return code;
};

export const revokeQrCode = (code: MockQrCode) => {
  code.revokedAt ??= new Date().toISOString();
  return code;
};

/** Why a code or invite can't be used, as the route answers it. */
export type Problem = { status: 403 | 404 | 409 | 410; message: string };

/** A scanned token or a typed short code (any case, with or without the dash). */
const findQrCode = (world: MockWorld, tokenOrShortCode: string) => {
  const short = QrShortCode.safeParse(tokenOrShortCode);
  return world.qrCodes.find(
    (c) => c.token === tokenOrShortCode || (short.success && c.shortCode === short.data),
  );
};

/** A code anyone can still use (not revoked, not expired, team live), or why not. */
export const usableQrCode = (
  world: MockWorld,
  tokenOrShortCode: string,
  now = Date.now(),
): MockQrCode | Problem => {
  const code = findQrCode(world, tokenOrShortCode);
  if (!code) return { status: 404, message: 'That code isn’t a Team IMPACT team code' };
  if (code.revokedAt) return { status: 410, message: 'The coach turned this code off' };
  if (Date.parse(code.expiresAt) <= now) {
    return { status: 410, message: 'This code has expired. Ask the coach for a new one' };
  }
  if (!isTeamLive(world, code.teamId)) {
    return { status: 410, message: 'This team isn’t taking new members' };
  }
  return code;
};

/** A live code, or null. */
export const liveQrCode = (world: MockWorld, tokenOrShortCode: string, now = Date.now()) => {
  const code = usableQrCode(world, tokenOrShortCode, now);
  return 'status' in code ? null : code;
};

/** Roles that join teams. Coaches are invited; alumni, recruiters and staff never join. */
const JOINING_ROLES: readonly MockUser['role'][] = ['athlete', 'parent', 'teen'];

/**
 * The fast lane: a live code joins the team straight away and the join lands on the code's join
 * list. Used by `POST /qr/:code/join`. `joined` is false if they were already on the team.
 */
export const redeemQrCode = (
  world: MockWorld,
  u: MockUser,
  tokenOrShortCode: string,
  now = Date.now(),
): Problem | { code: MockQrCode; joined: boolean } => {
  const code = usableQrCode(world, tokenOrShortCode, now);
  if ('status' in code) return code;
  if (!JOINING_ROLES.includes(u.role)) {
    return { status: 403, message: 'Your account can’t join a team with a code' };
  }
  const joinedAt = new Date(now).toISOString();
  const joined = addTeamMember(world, code.teamId, u.id, 'qr_code', joinedAt);
  if (joined) code.joins.push({ userId: u.id, joinedAt });
  return { code, joined };
};

export const qrCodeJoins = (world: MockWorld, code: MockQrCode): QrCodeJoin[] =>
  code.joins.flatMap((j) => {
    const u = world.user(j.userId);
    return u ? [{ user: summaryOf(u), joinedAt: j.joinedAt }] : [];
  });

// Coach invites -----------------------------------------------------------------------------------

export const coachInviteView = (world: MockWorld, invite: MockCoachInvite): CoachInvite => ({
  id: invite.id,
  teamId: invite.teamId,
  email: invite.email,
  invitedBy: summaryOf(world.user(invite.invitedById)!),
  expiresAt: invite.expiresAt,
  acceptedAt: invite.acceptedAt,
  revokedAt: invite.revokedAt,
  createdAt: invite.createdAt,
});

const isPending = (invite: MockCoachInvite, now = Date.now()) =>
  invite.acceptedAt === null && invite.revokedAt === null && Date.parse(invite.expiresAt) > now;

export const pendingCoachInvites = (world: MockWorld, teamId: string) =>
  world.coachInvites.filter((i) => i.teamId === teamId && isPending(i));

export const createCoachInvite = (
  world: MockWorld,
  u: MockUser,
  teamId: string,
  email: string,
  now = Date.now(),
): { error: string; status: number } | { invite: MockCoachInvite; token: string } => {
  const alreadyCoach = world.teamMembers.some((m) => {
    const member = world.user(m.userId);
    return m.teamId === teamId && member?.role === 'coach' && member.email === email;
  });
  if (alreadyCoach) return { error: 'Already a coach on this team', status: 409 };
  if (pendingCoachInvites(world, teamId).some((i) => i.email === email)) {
    return { error: 'An invite to this email is already waiting', status: 409 };
  }
  const token = newToken();
  const invite: MockCoachInvite = {
    id: world.newId(),
    teamId,
    email,
    tokenHash: hashInviteToken(token),
    invitedById: u.id,
    expiresAt: new Date(now + INVITE_DAYS * 24 * HOUR).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(now).toISOString(),
  };
  world.coachInvites.push(invite);
  const team = world.teams.find((t) => t.id === teamId);
  sendEmail(world, {
    to: email,
    subject: `You're invited to coach ${team?.name ?? 'a team'} on Team IMPACT`,
    body: `${u.firstName} ${u.lastName} invited you. The link works once, for 7 days, and only for ${email}.`,
    link: inviteLink(token),
  });
  return { invite, token };
};

/** For `/invites/:token`: an invite that can still be accepted, or why not. */
export const usableInvite = (
  world: MockWorld,
  token: string,
  now = Date.now(),
): MockCoachInvite | Problem => {
  const hash = hashInviteToken(token);
  const invite = world.coachInvites.find((i) => i.tokenHash === hash);
  if (!invite) return { status: 404, message: 'No such invite' };
  if (invite.revokedAt) return { status: 410, message: 'This invite was withdrawn' };
  if (invite.acceptedAt) return { status: 410, message: 'This invite has already been used' };
  if (Date.parse(invite.expiresAt) <= now) {
    return { status: 410, message: 'This invite has expired. Ask Team Impact to resend it' };
  }
  return invite;
};

/** A pending invite, or null if it's used, revoked, expired or unknown. */
export const findCoachInvite = (world: MockWorld, token: string, now = Date.now()) => {
  const invite = usableInvite(world, token, now);
  return 'status' in invite ? null : invite;
};

/**
 * Accepting puts the coach on the team. A team's first coach makes it live: it shows in the join
 * search and takes requests and codes from then on.
 */
export const acceptCoachInvite = (world: MockWorld, invite: MockCoachInvite, coach: MockUser) => {
  invite.acceptedAt = new Date().toISOString();
  addTeamMember(world, invite.teamId, coach.id, 'coach_invite');
  const t = world.teams.find((x) => x.id === invite.teamId);
  if (t?.status === 'invited') t.status = 'live';
};
