import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent, Community, UserSummary } from '@team-impact/contracts';
import { EventsPage } from './Events';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const joined = { joinedAt: '2026-10-01T12:00:00.000Z' };
const base = {
  about: '',
  memberCount: 9,
  moderation: 'approved' as const,
  createdAt: joined.joinedAt,
};
const maya: UserSummary = {
  id: id(101),
  firstName: 'Maya',
  lastName: 'Chen',
  role: 'staff',
  avatarUrl: null,
};

const teamImpact = {
  ...base,
  id: id(302),
  name: 'Team Impact',
  kind: 'team_impact',
  myMembership: joined,
} as const;
const soccer = {
  ...base,
  id: id(301),
  name: "Tufts Women's Soccer",
  kind: 'team',
  teamId: id(201),
  myMembership: null,
} as const;
const COMMUNITIES: Community[] = [soccer, teamImpact];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A fake API that records each new event, and answers it with `reply` (default: made). */
const fakeApi = (reply?: () => Response) => {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  const hosted: CalendarEvent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      if (path === '/communities') return json(COMMUNITIES);
      if (path === '/staff/events') return json(hosted);
      if (path === `/communities/${teamImpact.id}/events` && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as Record<string, string>;
        writes.push({ path, body });
        if (reply) return reply();
        const event = {
          id: id(9000 + writes.length),
          title: body.title!,
          details: body.details ?? null,
          startsAt: body.startsAt!,
          endsAt: body.endsAt ?? null,
          location: body.location!,
          host: maya,
          community: { id: teamImpact.id, name: teamImpact.name, kind: teamImpact.kind },
          goingCount: 1,
          myRsvp: 'going',
          moderation: 'approved',
          createdAt: new Date().toISOString(),
        } satisfies CalendarEvent;
        hosted.unshift(event);
        return json(event, 201);
      }
      return json({ error: { code: 'not_found', message: path } }, 404);
    }),
  );
  return writes;
};

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const ready = async () => {
  render(<EventsPage />);
  await waitFor(() =>
    expect(
      Array.from(screen.getByLabelText<HTMLSelectElement>('Community').options).map((o) => o.text),
    ).toEqual(['Team Impact']),
  );
};

describe('Events page', () => {
  it('sends the event with ISO times, leaving out blank optional fields', async () => {
    const writes = fakeApi();
    await ready();
    fill('Title', 'Gala');
    fill('Starts', '2026-12-05T18:00');
    fill('Where', 'Boston');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));

    expect((await screen.findByRole('status')).textContent).toBe('Event added to Team Impact.');
    expect(writes).toEqual([
      {
        path: `/communities/${teamImpact.id}/events`,
        // The time staff typed is theirs; the API gets the same moment as an ISO timestamp.
        body: {
          title: 'Gala',
          startsAt: new Date('2026-12-05T18:00').toISOString(),
          location: 'Boston',
        },
      },
    ]);
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('');
    expect(await screen.findByRole('cell', { name: 'Gala' })).toBeTruthy();
  });

  it('sends the end time and details when given', async () => {
    const writes = fakeApi();
    await ready();
    fill('Title', 'Gala');
    fill('Starts', '2026-12-05T18:00');
    fill('Ends (optional)', '2026-12-05T21:00');
    fill('Where', 'Boston');
    fill('Details (optional)', 'Black tie.');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    await screen.findByRole('status');
    expect(writes[0]!.body).toMatchObject({
      endsAt: new Date('2026-12-05T21:00').toISOString(),
      details: 'Black tie.',
    });
  });

  it('shows the API’s error and keeps what was typed', async () => {
    fakeApi(
      () =>
        new Response(
          JSON.stringify({ error: { code: 'bad_request', message: 'End after it starts.' } }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    await ready();
    fill('Title', 'Gala');
    fill('Starts', '2026-12-05T18:00');
    fill('Ends (optional)', '2026-12-05T17:00');
    fill('Where', 'Boston');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect((await screen.findByRole('alert')).textContent).toBe('End after it starts.');
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Gala');
  });
});
