// Blocks in the access policy (PRD §9, P2): a block between the actor and someone hides that
// person's profile, card and roster entry, and a blocked parent's child, both ways. Staff, and the
// coaches who run a team, are never cut off from what they manage.
import { describe, expect, it } from 'vitest';
import { type Actor, type CardFacts, can, contactAudience } from './policy';
import type { Role } from './roles';

const actor = (role: Role, teamIds: string[] = [], id: string = role): Actor => ({
  id,
  role,
  teamIds,
  companyId: role === 'recruiter' ? 'acme' : null,
});

const card = (blocked: boolean): CardFacts => ({
  athleteId: 'jordan',
  ownerRole: 'athlete',
  teamId: 't1',
  published: true,
  openToRecruiting: true,
  ownerSuspended: false,
  blocked,
});

const person = (blocked: boolean) => ({
  id: 'jordan',
  role: 'athlete' as const,
  teamIds: ['t1'],
  card: card(blocked),
  sharesOpenCommunity: false,
  blocked,
});

describe('policy: blocks', () => {
  it('hide a teammate’s profile and card, and their contacts with them', () => {
    const lisa = actor('parent', ['t1'], 'lisa');
    expect(can(lisa, 'person.read', person(false))).toBe(true);
    expect(can(lisa, 'person.read', person(true))).toBe(false);
    expect(can(lisa, 'card.read', card(true))).toBe(false);
    expect(contactAudience(lisa, card(true))).toBe('none');
  });

  it('hide the athlete from a recruiter who could otherwise see them', () => {
    const r = actor('recruiter');
    expect(can(r, 'card.read', card(false))).toBe(true);
    expect(can(r, 'card.read', card(true))).toBe(false);
    expect(can(r, 'person.read', person(true))).toBe(false);
  });

  it('never hide your own profile or card, or anyone from staff', () => {
    const jordan = actor('athlete', ['t1'], 'jordan');
    expect(can(jordan, 'card.read', card(true))).toBe(true);
    expect(can(jordan, 'person.read', person(true))).toBe(true);
    expect(can(actor('staff'), 'person.read', person(true))).toBe(true);
    expect(can(actor('staff'), 'card.read', card(true))).toBe(true);
  });

  it('hide a teen across a block', () => {
    const teen = { id: 'noah', teamIds: ['t1'] };
    const teammate = actor('athlete', ['t1']);
    expect(can(teammate, 'teen.read', { ...teen, blocked: false })).toBe(true);
    expect(can(teammate, 'teen.read', { ...teen, blocked: true })).toBe(false);
    expect(can(actor('teen', [], 'noah'), 'teen.read', { ...teen, blocked: true })).toBe(true);
  });

  it('hide a blocked parent’s child from the blocker, never from the parent', () => {
    const child = { parentId: 'lisa', teamId: 't1' };
    expect(can(actor('athlete', ['t1']), 'child.read', { ...child, parentBlocked: true })).toBe(
      false,
    );
    expect(can(actor('athlete', ['t1']), 'child.read', { ...child, parentBlocked: false })).toBe(
      true,
    );
    expect(can(actor('parent', [], 'lisa'), 'child.read', { ...child, parentBlocked: true })).toBe(
      true,
    );
  });

  it('hide a roster entry, except from the coaches and staff who run the team', () => {
    const entry = { teamId: 't1', memberId: 'lisa', blocked: true };
    expect(can(actor('athlete', ['t1']), 'team.listMember', entry)).toBe(false);
    expect(can(actor('athlete', ['t1']), 'team.listMember', { ...entry, blocked: false })).toBe(
      true,
    );
    expect(can(actor('coach', ['t1']), 'team.listMember', entry)).toBe(true);
    expect(can(actor('coach', ['t2']), 'team.listMember', entry)).toBe(false);
    expect(can(actor('staff'), 'team.listMember', entry)).toBe(true);
    // You always see yourself.
    expect(can(actor('parent', ['t1'], 'lisa'), 'team.listMember', entry)).toBe(true);
  });
});
