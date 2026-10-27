import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as fx from '../../mock/fixtures';
import { INVITE_TOKENS } from '../../mock/team';
import { fixtureRows } from './fixtures';

const rows = Object.fromEntries(
  fixtureRows().map(([table, tableRows]) => [getTableName(table), tableRows]),
) as Record<string, Record<string, unknown>[]>;
const ids = (table: string) => rows[table]!.map((r) => r.id);
const byId = (table: string) => new Map(rows[table]!.map((r) => [r.id, r]));

describe('fixture seed', () => {
  it('seeds the same world the mock serves, with the same ids', () => {
    expect(ids('users')).toEqual(fx.ALL_USERS.map((u) => u.id));
    expect(ids('teams')).toEqual(fx.TEAMS.map((t) => t.id));
    expect(ids('communities')).toEqual(fx.COMMUNITIES.map((c) => c.id));
    expect(ids('children')).toEqual(fx.CHILDREN.map((c) => c.id));
    expect(ids('posts')).toEqual(fx.POSTS.map((p) => p.id));
    expect(ids('events')).toEqual(fx.EVENTS.map((e) => e.id));
    expect(new Set(rows.communities!.map((c) => c.kind))).toEqual(
      new Set(['team', 'team_impact', 'medical', 'interest']),
    );
  });

  it('only makes open interest communities official, and only user-made ones private', () => {
    for (const c of rows.communities!) {
      if (c.official) expect([c.kind, c.private], String(c.name)).toEqual(['interest', false]);
      if (c.private) expect(['interest', 'medical'], String(c.name)).toContain(c.kind);
      expect(c.kind === 'team', String(c.name)).toBe(c.teamId != null);
    }
  });

  it('keeps teens and recruiters out of medical communities, and recruiters out of all of them', () => {
    const users = byId('users');
    const communities = byId('communities');
    for (const m of rows.memberships!) {
      const role = users.get(m.userId)!.userType;
      expect(role).not.toBe('recruiter');
      if (communities.get(m.communityId)!.kind === 'medical') expect(role).not.toBe('teen');
    }
  });

  it('opts members in to recruiter search only in official interest communities', () => {
    const communities = byId('communities');
    for (const m of rows.memberships!.filter((r) => r.recruiterSearchOptIn)) {
      const c = communities.get(m.communityId)!;
      expect([c.kind, c.official]).toEqual(['interest', true]);
    }
  });

  it('stores coach invite tokens only as hashes', () => {
    const stored = JSON.stringify(rows.coach_invites);
    for (const token of Object.values(INVITE_TOKENS)) expect(stored).not.toContain(token);
  });

  it('gives children no account: they are never users', () => {
    const userIds = new Set(ids('users'));
    for (const child of fx.CHILDREN) expect(userIds.has(child.id)).toBe(false);
  });
});
