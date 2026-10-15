import { describe, expect, it } from 'vitest';
import type { Community } from './communities';
import { canCreateEventIn, NewEventRequest, RsvpRequest } from './events';
import {
  MarkNotificationsReadRequest,
  NOTIFICATION_KINDS,
  NOTIFICATION_PREF,
} from './notifications';
import { canCommentIn, canPostIn, NewPostRequest } from './posts';

const ID = '00000000-0000-4000-8000-000000000001';
const NOW = '2026-10-13T12:00:00.000Z';
const joined = { joinedAt: NOW };
const base = {
  id: ID,
  name: 'x',
  about: 'x',
  memberCount: 1,
  moderation: 'approved',
  createdAt: NOW,
} as const;
const team: Community = { ...base, kind: 'team', teamId: ID, myMembership: joined };
const teamImpact: Community = { ...base, kind: 'team_impact', myMembership: joined };
const official: Community = {
  ...base,
  kind: 'interest',
  official: true,
  private: false,
  myJoinRequest: null,
  createdBy: { id: ID, firstName: 'A', lastName: 'B', role: 'athlete', avatarUrl: null },
  myMembership: null,
};

describe('posting permissions (PRD §5)', () => {
  it('never lets parents or recruiters post', () => {
    for (const c of [team, teamImpact]) {
      expect(canPostIn('parent', c)).toBe(false);
      expect(canPostIn('recruiter', c)).toBe(false);
    }
  });

  it('lets teens post only in their team community', () => {
    expect(canPostIn('teen', team)).toBe(true);
    expect(canPostIn('teen', teamImpact)).toBe(false);
  });

  it('needs membership for everyone else', () => {
    expect(canPostIn('athlete', team)).toBe(true);
    expect(canPostIn('athlete', { ...team, myMembership: null })).toBe(false);
  });

  it('keeps recruiters out of comments and teens inside their team', () => {
    expect(canCommentIn('recruiter', 'team_impact')).toBe(false);
    expect(canCommentIn('parent', 'interest')).toBe(true);
    expect(canCommentIn('teen', 'team')).toBe(true);
    expect(canCommentIn('teen', 'interest')).toBe(false);
  });

  it('keeps parents and teens from hosting events', () => {
    expect(canCreateEventIn('parent', team)).toBe(false);
    expect(canCreateEventIn('teen', team)).toBe(false);
    expect(canCreateEventIn('coach', team)).toBe(true);
    expect(canCreateEventIn('recruiter', official)).toBe(true);
    expect(canCreateEventIn('recruiter', teamImpact)).toBe(false);
  });

  it('accepts only http(s) image links on posts', () => {
    expect(NewPostRequest.safeParse({ text: 'Hi', imageUrl: 'https://x.org/a.png' }).success).toBe(
      true,
    );
    expect(NewPostRequest.safeParse({ text: 'Hi', imageUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });

  it('checks event times without a community in the body', () => {
    const e = { title: 'T', location: 'L', startsAt: NOW, endsAt: '2026-10-13T11:00:00.000Z' };
    expect(NewEventRequest.safeParse(e).success).toBe(false);
    expect(RsvpRequest.safeParse({ status: 'maybe' }).success).toBe(true);
  });
});

describe('notifications', () => {
  it('maps every kind but staff warnings to a preference switch', () => {
    for (const kind of NOTIFICATION_KINDS) {
      if (kind === 'warning') expect(kind in NOTIFICATION_PREF).toBe(false);
      else expect(NOTIFICATION_PREF[kind]).toBeTruthy();
    }
  });

  it('marks all read with no ids, but not with an empty list', () => {
    expect(MarkNotificationsReadRequest.safeParse({}).success).toBe(true);
    expect(MarkNotificationsReadRequest.safeParse({ ids: [] }).success).toBe(false);
  });
});
