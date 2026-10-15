import { describe, expect, it } from 'vitest';
import { CommunityMember } from './index';

const ID = '00000000-0000-4000-8000-000000000001';
const NOW = '2026-10-13T12:00:00.000Z';
const user = { id: ID, firstName: 'Jordan', lastName: 'Lee', role: 'athlete', avatarUrl: null };

describe('community member contracts', () => {
  it('carries who someone is, their role and when they joined', () => {
    expect(CommunityMember.parse({ user, joinedAt: NOW }).user.role).toBe('athlete');
  });

  it('carries no contact details', () => {
    const parsed = CommunityMember.parse({ user: { ...user, email: 'x@y.org' }, joinedAt: NOW });
    expect(parsed.user).not.toHaveProperty('email');
  });
});
