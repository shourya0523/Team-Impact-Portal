import {
  ageOn,
  type JoinRequest,
  type NewChild,
  type PendingChild,
  type PendingRecruiter,
  type QrCodeLifetime,
} from '@team-impact/contracts';
import { id, TEAMS, USERS } from './fixtures';
import type { MockWorld } from './world';

/**
 * Sign-up and joining a team on the mock API: team QR codes, coach invites, recruiters waiting on
 * staff, and the children parents add to join requests. Pure helpers over a `MockWorld`.
 */

/** A child profile run by a parent. No login, no email, no birth date (PRD §2, data model). */
export interface MockChild {
  id: string;
  parentId: string;
  teamId: string;
  firstName: string;
  lastInitial?: string;
  age: number;
}

export interface MockQrCode {
  id: string;
  teamId: string;
  token: string;
  createdById: string;
  lifetime: QrCodeLifetime;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

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

export interface MockPendingRecruiter extends Omit<PendingRecruiter, 'company'> {
  companyId: string;
}

const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const SOCCER = id(201);
const LACROSSE = id(202);

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

const qrCodes = (): MockQrCode[] => [
  {
    id: id(1301),
    teamId: SOCCER,
    token: QR_TOKENS.live,
    createdById: USERS.coach.id,
    lifetime: 'week',
    expiresAt: fromNow(6),
    revokedAt: null,
    createdAt: fromNow(-1),
  },
  {
    id: id(1302),
    teamId: SOCCER,
    token: QR_TOKENS.revoked,
    createdById: USERS.coach.id,
    lifetime: 'week',
    expiresAt: fromNow(3),
    revokedAt: fromNow(-1),
    createdAt: fromNow(-4),
  },
  {
    id: id(1303),
    teamId: SOCCER,
    token: QR_TOKENS.expired,
    createdById: USERS.coach.id,
    lifetime: 'tonight',
    expiresAt: fromNow(-2),
    revokedAt: null,
    createdAt: fromNow(-3),
  },
];

const coachInvites = (): MockCoachInvite[] => [
  {
    id: id(1401),
    teamId: LACROSSE,
    email: 'pat.nguyen@tufts.edu',
    token: INVITE_TOKENS.lacrosse,
    invitedById: USERS.staff.id,
    expiresAt: fromNow(5),
    acceptedAt: null,
    revokedAt: null,
    createdAt: fromNow(-2),
  },
  {
    id: id(1402),
    teamId: SOCCER,
    email: 'alex.moore@tufts.edu',
    token: INVITE_TOKENS.revoked,
    invitedById: USERS.coach.id,
    expiresAt: fromNow(5),
    acceptedAt: null,
    revokedAt: fromNow(-1),
    createdAt: fromNow(-2),
  },
  {
    id: id(1403),
    teamId: SOCCER,
    email: 'jamie.cole@tufts.edu',
    token: INVITE_TOKENS.expired,
    invitedById: USERS.coach.id,
    expiresAt: fromNow(-1),
    acceptedAt: null,
    revokedAt: null,
    createdAt: fromNow(-8),
  },
];

/** Per-world state for this area. */
export const newSignupState = () => ({
  qrCodes: qrCodes(),
  coachInvites: coachInvites(),
  pendingRecruiters: [] as MockPendingRecruiter[],
  /** Teams whose first coach accepted their invite while the mock ran. */
  liveTeamIds: new Set<string>(),
});
export type SignupState = ReturnType<typeof newSignupState>;

/** Live teams are in the join search and accept requests and QR joins. */
export const isTeamLive = (world: MockWorld, teamId: string) => {
  const team = TEAMS.find((t) => t.id === teamId);
  if (!team || team.status === 'archived') return false;
  return team.status === 'live' || world.signup.liveTeamIds.has(teamId);
};

/** What the coach sees about each child: first name, last initial and age, never the date. */
export const pendingChildren = (children: NewChild[] | undefined): PendingChild[] =>
  (children ?? []).map((c) => ({
    firstName: c.firstName.trim(),
    lastInitial: c.lastInitial.trim().toUpperCase(),
    age: ageOn(c.birthDate),
  }));

type QrProblem = { status: 404 | 410; message: string };

/** A code anyone can still use, or why not. */
export const usableQrCode = (world: MockWorld, token: string): MockQrCode | QrProblem => {
  const code = world.signup.qrCodes.find((c) => c.token === token);
  if (!code) return { status: 404, message: 'That code isn’t a Team IMPACT team code' };
  if (code.revokedAt) return { status: 410, message: 'The coach turned this code off' };
  if (code.expiresAt <= new Date().toISOString()) {
    return { status: 410, message: 'This code has expired. Ask the coach for a new one' };
  }
  if (!isTeamLive(world, code.teamId)) {
    return { status: 410, message: 'This team isn’t taking new members' };
  }
  return code;
};

/** An invite that can still be accepted, or why not. */
export const usableInvite = (
  world: MockWorld,
  token: string,
): MockCoachInvite | { status: 404 | 410; message: string } => {
  const invite = world.signup.coachInvites.find((i) => i.token === token);
  if (!invite) return { status: 404, message: 'No such invite' };
  if (invite.revokedAt) return { status: 410, message: 'This invite was withdrawn' };
  if (invite.acceptedAt) return { status: 410, message: 'This invite has already been used' };
  if (invite.expiresAt <= new Date().toISOString()) {
    return { status: 410, message: 'This invite has expired. Ask Team Impact to resend it' };
  }
  return invite;
};

/** Puts `userId` on the team once; true if they were added. */
export const addTeamMember = (
  world: MockWorld,
  teamId: string,
  userId: string,
  joinedVia: 'coach_invite' | 'join_request' | 'qr_code',
) => {
  if (world.teamMembers.some((m) => m.teamId === teamId && m.userId === userId)) return false;
  world.teamMembers.push({ teamId, userId, joinedVia, joinedAt: new Date().toISOString() });
  return true;
};

/**
 * The coach (or staff) decides a pending request. Approving puts the requester on the team and
 * creates the profiles of any children the parent added: rows a parent runs, never accounts.
 */
export const decideJoinRequest = (
  world: MockWorld,
  request: JoinRequest,
  decision: 'approve' | 'decline',
) => {
  request.status = decision === 'approve' ? 'approved' : 'declined';
  request.decidedAt = new Date().toISOString();
  if (decision !== 'approve') return;
  addTeamMember(world, request.teamId, request.requester.id, 'join_request');
  if (request.role !== 'parent') return;
  for (const child of request.children ?? []) {
    world.children.push({
      id: world.newId(),
      parentId: request.requester.id,
      teamId: request.teamId,
      firstName: child.firstName,
      lastInitial: child.lastInitial,
      age: child.age,
    });
  }
};
