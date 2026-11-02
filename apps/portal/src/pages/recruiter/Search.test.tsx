import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../../session';
import { SearchPage } from './Search';

/**
 * TI-121 (R2–R4): the official-community filter shows only while the identity-search flag is on,
 * offers official interest communities only, and every filter travels in the search request.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COMMUNITIES = [
  { id: 'c-official', name: 'First-Gen Athletes', kind: 'interest', official: true },
  { id: 'c-plain', name: 'Book Club', kind: 'interest', official: false },
  { id: 'c-team', name: 'Tufts Soccer', kind: 'team', official: false },
  { id: 'c-medical', name: 'Heart Families', kind: 'medical', official: false },
];

const fakeApi = (identitySearch: boolean) => {
  const searches: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.replace(/^\/api/, '');
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      if (path === '/me') return json({ user: { id: 'r', role: 'recruiter' } });
      if (path === '/config/flags') return json({ identitySearch, medicalCommunities: true });
      if (path === '/communities') return json(COMMUNITIES);
      if (path.startsWith('/search/athletes')) {
        searches.push(path);
        return json({ items: [], nextCursor: null });
      }
      return json([]);
    }),
  );
  return searches;
};

const renderAt = (url = '/search') =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

describe('recruiter search', () => {
  it('offers official interest communities only, while the flag is on', async () => {
    fakeApi(true);
    renderAt();
    // useApi keeps the previous (empty) list until the flagged request lands.
    await waitFor(() => {
      const select = screen.getByLabelText('Official community');
      const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
      expect(options).toEqual(['Any', 'First-Gen Athletes']);
    });
  });

  it('hides the official-community filter entirely when the flag is off', async () => {
    fakeApi(false);
    renderAt();
    await screen.findByLabelText('Region');
    // Let the flags request land, then make sure the filter never appeared.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByLabelText('Official community')).toBeNull();
  });

  it('sends the filters from the URL with the search, and clears them', async () => {
    const searches = fakeApi(true);
    renderAt('/search?region=northeast&major=Economics&communityId=c-official');
    await screen.findByLabelText('Official community');
    const last = () => searches.at(-1) ?? '';
    expect(last()).toContain('region=northeast');
    expect(last()).toContain('major=Economics');
    expect(last()).toContain('communityId=c-official');

    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(last()).not.toContain('region=');
    expect(last()).not.toContain('communityId=');
  });
});
