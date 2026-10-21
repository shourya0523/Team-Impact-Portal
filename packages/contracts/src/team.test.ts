import { describe, expect, it } from 'vitest';
import {
  CreateQrCodeRequest,
  QrShortCode,
  RosterParent,
  TeamQrCodeHistoryEntry,
  TeamRoster,
} from './index';

const ID = '00000000-0000-4000-8000-000000000001';
const NOW = '2026-10-13T12:00:00.000Z';
const coach = { id: ID, firstName: 'Dana', lastName: 'Rivera', role: 'coach', avatarUrl: null };

describe('team management contracts', () => {
  it('reads a typed short code in any case, with or without the dash', () => {
    expect(QrShortCode.parse('jumb-q7k4')).toBe('JUMBQ7K4');
    expect(QrShortCode.safeParse('JUMB2026').success).toBe(false); // 0 is a look-alike
    expect(QrShortCode.safeParse('ABC').success).toBe(false);
  });

  it('labels a code optionally', () => {
    expect(CreateQrCodeRequest.parse({ lifetime: 'tonight' })).toEqual({ lifetime: 'tonight' });
    expect(CreateQrCodeRequest.safeParse({ lifetime: 'week', label: '' }).success).toBe(false);
  });

  it('never gives staff a code’s short code either', () => {
    const entry = TeamQrCodeHistoryEntry.parse({
      id: ID,
      teamId: ID,
      token: 'x'.repeat(24),
      shortCode: 'JUMBQ7K4',
      label: null,
      createdBy: coach,
      lifetime: 'week',
      expiresAt: NOW,
      revokedAt: null,
      joinCount: 0,
      createdAt: NOW,
    });
    expect(entry).not.toHaveProperty('shortCode');
  });

  it('strips anything but email and phone from a family contact', () => {
    const parent = RosterParent.parse({
      user: { ...coach, role: 'parent' },
      joinedVia: 'join_request',
      joinedAt: NOW,
      addedBy: null,
      children: [{ id: ID, firstName: 'Mateo', age: 9 }],
      contact: { email: 'lisa@example.org', linkedinUrl: 'https://linkedin.com/in/lisa' },
    });
    expect(parent.contact).toEqual({ email: 'lisa@example.org' });
    // A child is a first name on the roster; nothing else about them travels.
    expect(parent.children).toEqual([{ id: ID, firstName: 'Mateo' }]);
  });

  it('carries no contact field on athletes or teens', () => {
    const shape = TeamRoster.shape;
    expect(Object.keys(shape.athletes.element.shape)).not.toContain('contact');
    expect(Object.keys(shape.teens.element.shape)).not.toContain('contact');
  });
});
