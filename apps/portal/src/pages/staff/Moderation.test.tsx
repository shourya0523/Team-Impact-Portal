import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationTicket } from '@team-impact/contracts';
import { ModerationPage } from './Moderation';

const ticket = (n: number, over: Partial<ModerationTicket>): ModerationTicket => ({
  id: `00000000-0000-4000-8000-00000000500${n}`,
  target: { kind: 'post', id: `00000000-0000-4000-8000-00000000600${n}` },
  preview: `Post ${n}`,
  reasons: [],
  reportCount: 0,
  flags: [],
  status: 'open',
  resolution: null,
  createdAt: '2026-10-12T12:00:00.000Z',
  ...over,
});

const TICKETS = [
  ticket(1, { reasons: ['spam'], reportCount: 2 }),
  ticket(2, { flags: ['harassment', 'violence'] }),
  ticket(3, {}),
  ticket(4, {
    flags: ['harassment/threatening'],
    status: 'resolved',
    resolution: 'remove',
  }),
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fakeApi = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.replace(/^\/api/, '');
      const body = path === '/staff/moderation/tickets' ? TICKETS : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );

const rowOf = async (preview: string) => (await screen.findByText(preview)).closest('tr')!;

describe('moderation page', () => {
  it('says why each ticket is here: reports, the screen’s flags, or new', async () => {
    fakeApi();
    render(<ModerationPage />);
    within(await rowOf('Post 1')).getByText('Spam');
    within(await rowOf('Post 2')).getByText('Held by the screen: Harassment, Violence');
    within(await rowOf('Post 3')).getByText('New, waiting for review');
    within(await rowOf('Post 4')).getByText('Blocked by the screen: Harassment: threatening');
  });

  it('lets staff act on the author of what the screen blocked, without re-deciding the item', async () => {
    fakeApi();
    render(<ModerationPage />);
    const blocked = within(await rowOf('Post 4'));
    blocked.getByText('Blocked');
    expect(blocked.queryByRole('button', { name: 'Keep' })).toBeNull();
    fireEvent.click(blocked.getByRole('button', { name: 'Warn or suspend…' }));
    expect(screen.getByLabelText('Its author')).toBeTruthy();
    expect(screen.queryByLabelText('The item')).toBeNull();
  });
});
