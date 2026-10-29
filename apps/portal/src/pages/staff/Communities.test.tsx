import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Community, StaffCommunity, UserSummary } from '@team-impact/contracts';
import { SessionProvider } from '../../session';
import { CommunitiesPage } from './Communities';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const jordan: UserSummary = {
  id: id(103),
  firstName: 'Jordan',
  lastName: 'Lee',
  role: 'athlete',
  avatarUrl: null,
};

const base = (n: number, name: string) => ({
  id: id(n),
  name,
  about: 'About it.',
  memberCount: 3,
  moderation: 'approved' as const,
  createdAt: '2026-10-01T12:00:00.000Z',
  myMembership: null,
});
const userMade = { createdBy: jordan, private: false, myJoinRequest: null };

const team: Community = { ...base(301, 'Tufts Women’s Soccer'), kind: 'team', teamId: id(201) };
const medical: Community = { ...base(303, 'Heart warriors'), ...userMade, kind: 'medical' };
const open: Community = {
  ...base(305, 'Athletes in Finance'),
  ...userMade,
  kind: 'interest',
  official: false,
};
const captains: Community = { ...open, ...base(307, 'Team captains'), private: true };
const held: Community = { ...open, ...base(308, 'Pre-med athletes'), moderation: 'in_review' };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A fake staff API that records writes and applies the official switch. */
const fakeApi = () => {
  let rows: StaffCommunity[] = [team, medical, open, captains, held].map((community) => ({
    community,
    recruiterSearchOptInCount: community.kind === 'interest' ? 0 : null,
  }));
  const writes: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (path === '/config/flags')
        return json({ identitySearch: false, medicalCommunities: true });
      if (path === '/staff/communities') return json(rows);
      const official = path.match(/^\/staff\/communities\/(.+)\/official$/);
      if (official && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { official: boolean };
        writes.push({ method: 'PUT', path, body });
        rows = rows.map((r) =>
          r.community.id === official[1] && r.community.kind === 'interest'
            ? { ...r, community: { ...r.community, official: body.official } }
            : r,
        );
        return json(rows.find((r) => r.community.id === official[1]));
      }
      return json({ error: { code: 'not_found', message: path } }, 404);
    }),
  );
  return writes;
};

const row = async (name: string) => within((await screen.findByText(name)).closest('tr')!);

describe('staff communities page', () => {
  it('offers the official switch on open, approved interest communities only', async () => {
    fakeApi();
    render(
      <SessionProvider>
        <CommunitiesPage />
      </SessionProvider>,
    );

    expect((await row(open.name)).getByRole('button', { name: 'Mark official' })).toBeTruthy();
    expect((await row(captains.name)).getByText('Private: can’t be official')).toBeTruthy();
    expect((await row(held.name)).getByText('Approve it first')).toBeTruthy();
    for (const never of [team, medical]) {
      expect((await row(never.name)).getByText('Can’t be official'), never.name).toBeTruthy();
    }
    expect(screen.getAllByRole('button', { name: 'Mark official' })).toHaveLength(1);
  });

  it('marks a community official, then takes it back', async () => {
    const writes = fakeApi();
    render(
      <SessionProvider>
        <CommunitiesPage />
      </SessionProvider>,
    );
    const finance = await row(open.name);

    fireEvent.click(finance.getByRole('button', { name: 'Mark official' }));
    const on = await finance.findByRole('button', { name: 'Official' });
    expect(on.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(on);
    const off = await finance.findByRole('button', { name: 'Mark official' });
    expect(off.getAttribute('aria-pressed')).toBe('false');

    const path = `/staff/communities/${open.id}/official`;
    expect(writes).toEqual([
      { method: 'PUT', path, body: { official: true } },
      { method: 'PUT', path, body: { official: false } },
    ]);
  });
});
