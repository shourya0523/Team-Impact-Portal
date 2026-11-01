import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardWithContact, RecruiterListDetail, UserSummary } from '@team-impact/contracts';
import { colors } from '@team-impact/ui-tokens';
import { SessionProvider } from '../../session';
import { ListPage } from './List';

const LIST = '00000000-0000-4000-8000-000000000901';
const JORDAN_ENTRY = '00000000-0000-4000-8000-000000000951';
const GONE_ENTRY = '00000000-0000-4000-8000-000000000952';

const person = (n: number, firstName: string): UserSummary => ({
  id: `00000000-0000-4000-8000-00000000011${n}`,
  firstName,
  lastName: 'Ward',
  role: 'recruiter',
  avatarUrl: null,
});
const ELENA = person(0, 'Elena');
const TOM = person(1, 'Tom');

const card: CardWithContact = {
  id: '00000000-0000-4000-8000-000000000601',
  athleteId: '00000000-0000-4000-8000-000000000103',
  season: 2026,
  team: null,
  photoUrl: null,
  firstName: 'Jordan',
  lastName: 'Lee',
  jerseyNumber: '07',
  position: null,
  classYear: 2027,
  major: 'Economics',
  hometown: null,
  city: null,
  region: null,
  experience: [],
  skills: [],
  lookingFor: null,
  contact: {},
};

const list: RecruiterListDetail = {
  id: LIST,
  companyId: '00000000-0000-4000-8000-000000000801',
  name: 'Fall interns',
  color: colors.brand,
  note: null,
  owner: ELENA,
  athleteCount: 1,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  entries: [
    {
      id: JORDAN_ENTRY,
      available: true,
      card,
      addedBy: ELENA,
      addedAt: '2026-10-02T12:00:00.000Z',
      latestNote: null,
    },
    { id: GONE_ENTRY, available: false, addedBy: TOM, addedAt: '2026-10-03T12:00:00.000Z' },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Signs in as `me`, serves the list, and records every DELETE. */
const fakeApi = (me: UserSummary) => {
  const deleted: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      if (init?.method === 'DELETE') deleted.push(path);
      const body =
        path === '/me'
          ? me
          : path === '/config/flags'
            ? { identitySearch: true, medicalCommunities: true }
            : list;
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return deleted;
};

const renderPage = () =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[`/lists/${LIST}`]}>
        <Routes>
          <Route path="/lists/:id" element={<ListPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const rowOf = async (text: string) => (await screen.findByText(text)).closest('tr')!;

describe('list page', () => {
  it('shows an athlete who left the portal as no longer available, and lets it be cleared', async () => {
    const deleted = fakeApi(ELENA);
    renderPage();
    const gone = within(await rowOf('No longer available'));
    expect(gone.queryByRole('button', { name: 'Note' })).toBeNull();
    gone.getByText(/Tom Ward/);
    fireEvent.click(gone.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(deleted).toEqual([`/lists/${LIST}/entries/${GONE_ENTRY}`]));
    within(await rowOf('Jordan Lee')).getByRole('button', { name: 'Note' });
  });

  it('is shared with the company: no share button, and only the owner renames or deletes', async () => {
    fakeApi(TOM);
    renderPage();
    await screen.findByText(/Everyone at your company sees this list/);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete list' })).toBeNull();
    // Colleagues still work on its athletes.
    within(await rowOf('Jordan Lee')).getByRole('button', { name: 'Remove' });
  });
});
