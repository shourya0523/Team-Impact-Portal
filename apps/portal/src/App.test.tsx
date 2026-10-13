import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithContact, Me, Role } from '@team-impact/contracts';
import { App } from './App';

const ID = '00000000-0000-4000-8000-000000000103';

const meFor = (role: Role): Me => ({
  id: ID,
  firstName: role === 'staff' ? 'Maya' : 'Elena',
  lastName: role === 'staff' ? 'Chen' : 'Ward',
  role,
  avatarUrl: null,
  email: 'x@example.org',
  teamIds: [],
  notificationPrefs: {
    approvals: true,
    replies: true,
    events: true,
    announcements: true,
    emailDigest: false,
  },
  createdAt: '2026-10-01T12:00:00.000Z',
});

const card: CardWithContact = {
  id: ID,
  athleteId: ID,
  season: 2026,
  team: null,
  photoUrl: null,
  firstName: 'Jordan',
  lastName: 'Lee',
  jerseyNumber: '07',
  position: 'Midfielder',
  classYear: 2027,
  major: 'Economics',
  hometown: null,
  city: 'Medford',
  region: 'northeast',
  experience: null,
  skills: [],
  lookingFor: null,
  contact: { email: 'jordan.lee@tufts.edu' },
};

/** A fake API: `signedInAs` decides what /me says; everything else returns the fixtures above. */
const fakeApi = (signedInAs: Role | null) => {
  let me = signedInAs && meFor(signedInAs);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '').split('?')[0] ?? '';
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (path === '/me') {
        return me
          ? json(200, me)
          : json(401, { error: { code: 'unauthenticated', message: 'Sign in first' } });
      }
      if (path === '/config/flags')
        return json(200, { identitySearch: true, medicalCommunities: true });
      if (path === '/auth/dev-sign-in') {
        me = meFor((JSON.parse(String(init?.body)) as { role: Role }).role);
        return json(200, me);
      }
      if (path === '/search/athletes') return json(200, { items: [card], nextCursor: null });
      if (path === '/communities') return json(200, []);
      if (path.startsWith('/cards/')) return json(200, card);
      if (path === '/staff/teams') return json(200, []);
      return json(404, { error: { code: 'not_found', message: path } });
    }),
  );
};

const at = (path: string) => window.history.pushState({}, '', path);

beforeEach(() => at('/'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('portal shell', () => {
  it('sends signed-out visitors to sign-in', async () => {
    fakeApi(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sign in as' })).toBeTruthy();
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('signs a recruiter in to search, with recruiter navigation only', async () => {
    fakeApi(null);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Recruiter/ }));
    expect(await screen.findByRole('heading', { name: 'Search athletes' })).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'Lists' })).toBeTruthy();
    expect(nav.queryByRole('link', { name: 'Teams' })).toBeNull();
    expect(await screen.findByText('Jordan Lee')).toBeTruthy();
  });

  it('keeps staff out of recruiter pages', async () => {
    fakeApi('staff');
    at('/search');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Teams' })).toBeTruthy();
    expect(window.location.pathname).toBe('/staff/teams');
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'Moderation' })).toBeTruthy();
    expect(nav.queryByRole('link', { name: 'Search' })).toBeNull();
  });
});

describe('athlete card view', () => {
  it('shows the recruiter contacts and flips between resume and personal info', async () => {
    fakeApi('recruiter');
    at(`/athletes/${ID}`);
    render(<App />);
    const contact = (await screen.findByRole('heading', { name: 'Contact' })).parentElement!;
    expect(within(contact).getByText('jordan.lee@tufts.edu')).toBeTruthy();

    const athleteCard = screen.getByRole('button', { name: /athlete resume/ });
    expect(athleteCard.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(athleteCard);
    expect(athleteCard.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Show resume' }));
    expect(athleteCard.getAttribute('aria-pressed')).toBe('false');
  });
});
