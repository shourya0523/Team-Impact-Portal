import { randomBytes } from 'node:crypto';
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
import { id, summaryOf, USERS, type MockUser } from './fixtures';
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

/** The token is emailed and never returned; `/invites/:token` looks it up with `findCoachInvite`. */
export interface MockCoachInvite {
  id: string;
  teamId: string;
  email: string;
  token: string;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface MockChild {
  id: string;
  parentId: string;
  /** Null once their parent leaves the team, or before the parent's request is approved. */
  teamId: string | null;
  firstName: string;
  age: number;
}

const HOUR = 3_600_000;
const LIFETIME_HOURS: Record<QrCodeLifetime, number> = { tonight: 6, day: 24, week: 24 * 7 };
const INVITE_DAYS = 7;

/** Phones parents chose to give their team's coaches. Email comes from the account. */
export const PARENT_PHONES: Record<string, string> = {
  [USERS.lisa.id]: '+1 617 555 0142',
  [USERS.mark.id]: '+1 617 555 0178',
};

const SOCCER = id(201);

const newToken = () => randomBytes(24).toString('base64url');

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

/** One live code (with the four athletes who joined through it) and one revoked one. */
export const initialQrCodes = (now = Date.now()): MockQrCode[] => [
  {
    id: id(1201),
    teamId: SOCCER,
    token: 'fixture-live-token-soccer-0001',
    shortCode: 'JUMBQ7K4',
    label: 'Preseason meeting',
    createdById: USERS.coach.id,
    lifetime: 'week',
    expiresAt: new Date(now + 3 * 24 * HOUR).toISOString(),
    revokedAt: null,
    createdAt: new Date(now - 4 * 24 * HOUR).toISOString(),
    joins: [USERS.jordan, USERS.sam, USERS.riley, USERS.ava].map((u) => ({
      userId: u.id,
      joinedAt: '2026-10-02T12:00:00.000Z',
    })),
  },
  {
    id: id(1202),
    teamId: SOCCER,
    token: 'fixture-revoked-token-soccer-02',
    shortCode: 'RVKD7XQ4',
    label: 'Posted by mistake',
    createdById: USERS.coach.id,
    lifetime: 'day',
    expiresAt: new Date(now + 12 * HOUR).toISOString(),
    revokedAt: new Date(now - HOUR).toISOString(),
    createdAt: new Date(now - 2 * HOUR).toISOString(),
    joins: [],
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

const addMember = (
  world: MockWorld,
  teamId: string,
  userId: string,
  joinedVia: TeamMember['joinedVia'],
  joinedAt: string,
) => {
  if (world.teamMembers.some((m) => m.teamId === teamId && m.userId === userId)) return;
  world.teamMembers.push({ teamId, userId, joinedVia, joinedAt });
  // A parent's children who aren't on a team yet come with them, and only to their parent's team.
  if (world.user(userId)?.role === 'parent') {
    for (const child of world.children) {
      if (child.parentId === userId && child.teamId === null) child.teamId = teamId;
    }
  }
};

// Join requests -----------------------------------------------------------------------------------

export const pendingRequests = (world: MockWorld, teamId: string) =>
  world.joinRequests
    .filter((r) => r.teamId === teamId && r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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
  if (request.status !== 'pending') return { error: 'Already decided', status: 409 };
  const now = new Date().toISOString();
  request.status = decision === 'approve' ? 'approved' : 'declined';
  request.decidedAt = now;
  if (decision === 'approve')
    addMember(world, request.teamId, request.requester.id, 'join_request', now);
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

/** A code people can still join with: not revoked, not expired, and its team is live. */
export const isLive = (world: MockWorld, code: MockQrCode, now = Date.now()) =>
  code.revokedAt === null &&
  Date.parse(code.expiresAt) > now &&
  world.teams.find((t) => t.id === code.teamId)?.status === 'live';

/** Looks a scanned token or typed short code up; null unless it is live. */
export const liveQrCode = (world: MockWorld, tokenOrShortCode: string, now = Date.now()) => {
  const short = QrShortCode.safeParse(tokenOrShortCode);
  const code = world.qrCodes.find(
    (c) => c.token === tokenOrShortCode || (short.success && c.shortCode === short.data),
  );
  return code && isLive(world, code, now) ? code : null;
};

/** Roles that join teams. Coaches are invited; alumni, recruiters and staff never join. */
const JOINING_ROLES: readonly MockUser['role'][] = ['athlete', 'parent', 'teen'];

/**
 * The fast lane: a live code joins the team straight away. Exposed for the redeem route (`/qr/:code`)
 * so every way in records the join on the code. Returns an error message, or null on success.
 */
export const redeemQrCode = (
  world: MockWorld,
  u: MockUser,
  tokenOrShortCode: string,
  now = Date.now(),
): string | null => {
  const code = liveQrCode(world, tokenOrShortCode, now);
  if (!code) return 'This code has expired or been turned off. Ask your coach for a new one.';
  if (!JOINING_ROLES.includes(u.role)) return 'Your account can’t join a team with a code';
  if (world.teamIdsOf(u.id).includes(code.teamId)) return null;
  const joinedAt = new Date(now).toISOString();
  addMember(world, code.teamId, u.id, 'qr_code', joinedAt);
  code.joins.push({ userId: u.id, joinedAt });
  return null;
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
): { error: string; status: number } | { invite: MockCoachInvite } => {
  const alreadyCoach = world.teamMembers.some((m) => {
    const member = world.user(m.userId);
    return m.teamId === teamId && member?.role === 'coach' && member.email === email;
  });
  if (alreadyCoach) return { error: 'Already a coach on this team', status: 409 };
  if (pendingCoachInvites(world, teamId).some((i) => i.email === email)) {
    return { error: 'An invite to this email is already waiting', status: 409 };
  }
  const invite: MockCoachInvite = {
    id: world.newId(),
    teamId,
    email,
    token: newToken(),
    invitedById: u.id,
    expiresAt: new Date(now + INVITE_DAYS * 24 * HOUR).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(now).toISOString(),
  };
  world.coachInvites.push(invite);
  return { invite };
};

/** For `/invites/:token`: a pending invite, or null if it's used, revoked, expired or unknown. */
export const findCoachInvite = (world: MockWorld, token: string, now = Date.now()) => {
  const invite = world.coachInvites.find((i) => i.token === token);
  return invite && isPending(invite, now) ? invite : null;
};
