/* eslint-disable no-restricted-syntax -- Team colours are runtime data from the API; the colour rule is what's under test. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachInvite, College, Team, TeamCoaches, UserSummary } from '@team-impact/contracts';
import { TeamsPage } from './Teams';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY = 86_400_000;
const at = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString();
/** How the page writes a date: "Oct 13, 2026". */
const shown = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const tufts: College = { id: id(701), name: 'Tufts University' };
const northeastern: College = { id: id(702), name: 'Northeastern University' };

const team = (n: number, fields: Partial<Team>): Team => ({
  id: id(n),
  name: "Women's Soccer",
  college: tufts,
  sport: 'Soccer',
  gender: 'women',
  division: 'III',
  color: null,
  logoUrl: null,
  about: null,
  status: 'live',
  memberCount: 8,
  createdAt: '2026-10-01T12:00:00.000Z',
  ...fields,
});

const soccer = team(201, { color: '#1E3F7B' });
const basketball = team(210, { name: "Women's Basketball", sport: 'Basketball' });
const lacrosse = team(202, {
  name: "Men's Lacrosse",
  sport: 'Lacrosse',
  gender: 'men',
  status: 'archived',
});

const person = (n: number, firstName: string, lastName: string, role: UserSummary['role']) => ({
  id: id(n),
  firstName,
  lastName,
  role,
  avatarUrl: null,
});
const maya = person(101, 'Maya', 'Chen', 'staff');
const dana = person(102, 'Dana', 'Rivera', 'coach');
const robin = person(5010, 'Robin', 'Assistant', 'coach');

const invite = (n: number, email: string, fields: Partial<CoachInvite>): CoachInvite => ({
  id: id(n),
  teamId: soccer.id,
  email,
  invitedBy: maya,
  createdAt: at(-2),
  expiresAt: at(5),
  acceptedAt: null,
  revokedAt: null,
  ...fields,
});
// Newest first, as the API lists them.
const pending = invite(5001, 'assistant.coach@tufts.edu', {});
const expired = invite(5002, 'jamie.cole@tufts.edu', {
  invitedBy: dana,
  createdAt: at(-8),
  expiresAt: at(-1),
});
const revoked = invite(5003, 'alex.moore@tufts.edu', { revokedAt: at(-3), createdAt: at(-4) });
const accepted = invite(5004, 'robin.assistant@tufts.edu', {
  acceptedAt: at(-5),
  createdAt: at(-6),
});
/** The assistant's first invite, replaced by `pending` when staff resent it. */
const replaced = invite(5005, 'assistant.coach@tufts.edu', {
  createdAt: at(-10),
  expiresAt: at(-3),
});

const coach = (user: UserSummary, suspended = false) => ({
  user,
  joinedVia: 'coach_invite' as const,
  joinedAt: '2026-10-01T12:00:00.000Z',
  suspended,
});

type Write = { method: string; path: string; body?: unknown };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * A fake staff API that records every write. `onCreate` answers `POST /staff/teams`; the default
 * makes the team.
 */
const fakeApi = ({
  teams = [soccer, basketball, lacrosse],
  coaches = {
    coaches: [coach(dana), coach(robin)],
    invites: [pending, expired, revoked, accepted, replaced],
  },
  onCreate,
}: {
  teams?: Team[];
  coaches?: TeamCoaches;
  onCreate?: (body: Record<string, unknown>, list: Team[]) => Response;
} = {}) => {
  const list = teams.map((t) => ({ ...t }));
  const writes: Write[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (method !== 'GET') writes.push({ method, path, ...(body ? { body } : {}) });
      if (method === 'GET' && path === '/staff/teams') return json(list);
      if (method === 'GET' && path === '/staff/colleges') return json([northeastern, tufts]);
      if (method === 'GET' && /^\/staff\/teams\/[^/]+\/coaches$/.test(path)) return json(coaches);
      if (method === 'POST' && path === '/staff/teams') {
        if (onCreate) return onCreate(body, list);
        const made = team(5100, { ...(body as Partial<Team>), status: 'invited', memberCount: 0 });
        list.push(made);
        return json(made, 201);
      }
      const edited = /^\/staff\/teams\/([^/]+)(\/archive)?$/.exec(path);
      if (edited) {
        const t = list.find((x) => x.id === edited[1])!;
        if (edited[2] || body?.archived === true) t.status = 'archived';
        if (body?.archived === false) t.status = 'live';
        return json(t);
      }
      if (/^\/staff\/coach-invites\/[^/]+\/(resend|revoke)$/.test(path)) return json(pending);
      if (/^\/staff\/teams\/[^/]+\/coach-invites$/.test(path)) return json(pending, 201);
      if (method === 'DELETE' && path.startsWith('/teams/')) return json({});
      return json({ error: { code: 'not_found', message: path } }, 404);
    }),
  );
  return writes;
};

const conflict = (message: string) =>
  new Response(JSON.stringify({ error: { code: 'conflict', message } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

const dialog = (name: string) => within(screen.getByRole('dialog', { name }));

/** Opens "New team" and fills in a men's ice hockey team at Tufts, ready to submit. */
const startNewTeam = async () => {
  render(<TeamsPage />);
  expect(await screen.findByText("Women's Soccer")).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'New team' }));
  const sheet = dialog('New team');
  fireEvent.change(await sheet.findByLabelText('College'), { target: { value: tufts.id } });
  fireEvent.change(sheet.getByLabelText('Sport'), { target: { value: 'Ice Hockey' } });
  fireEvent.change(sheet.getByLabelText('Men’s or women’s'), { target: { value: 'men' } });
  fireEvent.change(sheet.getByLabelText('Display name'), {
    target: { value: "Men's Ice Hockey" },
  });
  fireEvent.change(sheet.getByLabelText('First coach’s email'), {
    target: { value: 'pat.lee@tufts.edu' },
  });
  return sheet;
};

const button = (scope: ReturnType<typeof within>, name: string) =>
  scope.getByRole('button', { name }) as HTMLButtonElement;

describe('staff teams page: creating a team', () => {
  it('shows why a colour can’t be used and won’t create the team with it', async () => {
    const writes = fakeApi();
    const sheet = await startNewTeam();
    const color = sheet.getByLabelText('Team colour (optional)') as HTMLInputElement;
    fireEvent.change(color, { target: { value: '#777777' } });

    expect(color.getAttribute('aria-invalid')).toBe('true');
    const why = document.getElementById(color.getAttribute('aria-describedby')!);
    expect(why?.textContent).toMatch(/can’t be read/);
    const create = button(sheet, 'Create team and invite coach');
    expect(create.disabled).toBe(true);
    // Even submitted another way (Enter in a field), nothing is sent.
    fireEvent.submit(color.closest('form')!);
    fireEvent.click(create);
    expect(writes).toEqual([]);
    // (A request would be sent synchronously from the submit; the single write asserted below,
    // after a valid submit, also shows these two sent nothing.)

    // The lightest grey white text reads on is fine.
    fireEvent.change(color, { target: { value: '#767676' } });
    expect(color.getAttribute('aria-invalid')).toBeNull();
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      path: '/staff/teams',
      body: {
        collegeId: tufts.id,
        sport: 'Ice Hockey',
        gender: 'men',
        name: "Men's Ice Hockey",
        division: 'III',
        color: '#767676',
        firstCoachEmail: 'pat.lee@tufts.edu',
      },
    });
  });

  it('leaves the colour out when none is picked, so the team gets navy', async () => {
    const writes = fakeApi();
    const sheet = await startNewTeam();
    fireEvent.click(button(sheet, 'Create team and invite coach'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.body).not.toHaveProperty('color');
  });

  it('only offers sports from the list', async () => {
    fakeApi();
    render(<TeamsPage />);
    expect(await screen.findByText("Women's Soccer")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New team' }));
    const sport = (await dialog('New team').findByLabelText('Sport')) as HTMLSelectElement;
    const options = Array.from(sport.options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(options).toContain('Ice Hockey');
    expect(options).not.toContain('Hockey');
    expect(sport.required).toBe(true);
  });

  it('points to the existing team when the new one would duplicate it', async () => {
    const writes = fakeApi();
    const sheet = await startNewTeam();
    fireEvent.change(sheet.getByLabelText('Sport'), { target: { value: 'Soccer' } });
    fireEvent.change(sheet.getByLabelText('Men’s or women’s'), { target: { value: 'women' } });

    expect(sheet.getByText(/already has this team/)).toBeTruthy();
    const create = button(sheet, 'Create team and invite coach');
    expect(create.disabled).toBe(true);
    fireEvent.submit(create.closest('form')!);
    expect(writes).toEqual([]);

    fireEvent.click(button(sheet, "Open Women's Soccer"));
    const edit = dialog("Edit Women's Soccer");
    expect((await edit.findByLabelText('Display name')).getAttribute('value')).toBe(
      "Women's Soccer",
    );
    // The edit form has loaded since, and still nothing was sent.
    expect(writes).toEqual([]);
  });

  it('shows the link to the existing team when the server catches a duplicate', async () => {
    // Someone else made Tufts men's ice hockey after this page loaded its list.
    const theirs = team(5200, {
      name: 'Jumbos Hockey',
      sport: 'Ice Hockey',
      gender: 'men',
      status: 'invited',
    });
    const writes = fakeApi({
      onCreate: (_body, list) => {
        list.push(theirs);
        return conflict('Tufts University already has a men’s Ice Hockey team');
      },
    });
    const sheet = await startNewTeam();
    fireEvent.click(button(sheet, 'Create team and invite coach'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await sheet.findByText(/already has a men’s Ice Hockey team/)).toBeTruthy();
    fireEvent.click(await sheet.findByRole('button', { name: 'Open Jumbos Hockey' }));
    expect(screen.getByRole('dialog', { name: 'Edit Jumbos Hockey' })).toBeTruthy();
  });
});

describe('staff teams page: editing a team', () => {
  const openEdit = async (name = "Women's Soccer") => {
    render(<TeamsPage />);
    fireEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }));
    const sheet = dialog(`Edit ${name}`);
    await sheet.findByLabelText('College');
    return sheet;
  };
  const value = (sheet: ReturnType<typeof within>, label: string) =>
    (sheet.getByLabelText(label) as HTMLInputElement | HTMLSelectElement).value;

  it('shows every field set at creation, filled in', async () => {
    fakeApi();
    const sheet = await openEdit();
    expect(value(sheet, 'College')).toBe(tufts.id);
    expect(value(sheet, 'Sport')).toBe('Soccer');
    expect(value(sheet, 'Men’s or women’s')).toBe('women');
    expect(value(sheet, 'Display name')).toBe("Women's Soccer");
    expect(value(sheet, 'Division')).toBe('III');
    expect(value(sheet, 'Team colour (optional)')).toBe('#1E3F7B');
  });

  it('sends only what changed, with the colour in upper case', async () => {
    const writes = fakeApi();
    const sheet = await openEdit();
    fireEvent.change(sheet.getByLabelText('Display name'), { target: { value: 'Jumbos Soccer' } });
    fireEvent.change(sheet.getByLabelText('Division'), { target: { value: 'II' } });
    fireEvent.change(sheet.getByLabelText('Team colour (optional)'), {
      target: { value: '#5a2d82' },
    });
    fireEvent.click(button(sheet, 'Save'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PATCH',
      path: `/staff/teams/${soccer.id}`,
      body: { name: 'Jumbos Soccer', division: 'II', color: '#5A2D82' },
    });
  });

  it('sends a new college, sport and gender, and a cleared colour as navy', async () => {
    const writes = fakeApi();
    const sheet = await openEdit();
    fireEvent.change(sheet.getByLabelText('College'), { target: { value: northeastern.id } });
    fireEvent.change(sheet.getByLabelText('Sport'), { target: { value: 'Rowing' } });
    fireEvent.change(sheet.getByLabelText('Men’s or women’s'), { target: { value: 'men' } });
    fireEvent.change(sheet.getByLabelText('Team colour (optional)'), { target: { value: '' } });
    fireEvent.click(button(sheet, 'Save'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PATCH',
      path: `/staff/teams/${soccer.id}`,
      body: { collegeId: northeastern.id, sport: 'Rowing', gender: 'men', color: null },
    });
  });

  it('sends nothing when nothing changed, or when only the colour’s case did', async () => {
    const writes = fakeApi();
    const sheet = await openEdit();
    fireEvent.change(sheet.getByLabelText('Team colour (optional)'), {
      target: { value: '#1e3f7b' },
    });
    fireEvent.click(button(sheet, 'Save'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual([]);
  });

  it('blocks saving an unreadable colour or a duplicate', async () => {
    const writes = fakeApi();
    const sheet = await openEdit("Women's Basketball");
    fireEvent.change(sheet.getByLabelText('Team colour (optional)'), {
      target: { value: '#7D7D7D' },
    });
    expect(button(sheet, 'Save').disabled).toBe(true);
    fireEvent.change(sheet.getByLabelText('Team colour (optional)'), { target: { value: '' } });
    expect(button(sheet, 'Save').disabled).toBe(false);

    fireEvent.change(sheet.getByLabelText('Sport'), { target: { value: 'Soccer' } });
    expect(sheet.getByText(/already has this team/)).toBeTruthy();
    expect(sheet.getByRole('button', { name: "Open Women's Soccer" })).toBeTruthy();
    expect(button(sheet, 'Save').disabled).toBe(true);
    fireEvent.submit(button(sheet, 'Save').closest('form')!);
    expect(writes).toEqual([]);

    // Once fixed, one save goes out with only the real change: the blocked ones sent nothing.
    fireEvent.change(sheet.getByLabelText('Sport'), { target: { value: 'Basketball' } });
    fireEvent.change(sheet.getByLabelText('Display name'), {
      target: { value: 'Jumbos Basketball' },
    });
    fireEvent.click(button(sheet, 'Save'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes).toEqual([
      {
        method: 'PATCH',
        path: `/staff/teams/${basketball.id}`,
        body: { name: 'Jumbos Basketball' },
      },
    ]);
  });
});

describe('staff teams page: coaches and invites', () => {
  const openCoaches = async () => {
    render(<TeamsPage />);
    fireEvent.click(await screen.findByRole('button', { name: "Coaches of Women's Soccer" }));
    const sheet = dialog("Women's Soccer: coaches");
    await sheet.findByRole('button', { name: 'Remove Dana Rivera as a coach' });
    return sheet;
  };
  /** Waits for an action to finish, so the next button isn't still disabled. */
  const settled = (sheet: ReturnType<typeof within>, name: string) =>
    waitFor(() => expect(button(sheet, name).disabled).toBe(false));

  it('shows when each invite was sent, by whom, and when it expires', async () => {
    fakeApi();
    const sheet = await openCoaches();
    expect(sheet.getByText(/Robin Assistant/)).toBeTruthy();
    expect(
      sheet.getByText(
        `Sent ${shown(pending.createdAt)} by Maya Chen · expires ${shown(pending.expiresAt)}`,
      ),
    ).toBeTruthy();
    expect(
      sheet.getByText(
        `Sent ${shown(expired.createdAt)} by Dana Rivera · expired ${shown(expired.expiresAt)}`,
      ),
    ).toBeTruthy();
    expect(sheet.getByText('assistant.coach@tufts.edu · Pending')).toBeTruthy();
    expect(sheet.getByText('jamie.cole@tufts.edu · Expired')).toBeTruthy();
    expect(sheet.getByText('alex.moore@tufts.edu · Revoked')).toBeTruthy();
    expect(sheet.getByText('robin.assistant@tufts.edu · Accepted')).toBeTruthy();
  });

  it('offers resend only on the newest pending or expired invite per email, and revoke on pending ones', async () => {
    fakeApi();
    const sheet = await openCoaches();
    const named = (name: string) => sheet.queryAllByRole('button', { name });
    expect(named('Resend the invite to assistant.coach@tufts.edu')).toHaveLength(1);
    expect(named('Resend the invite to jamie.cole@tufts.edu')).toHaveLength(1);
    expect(named('Resend the invite to alex.moore@tufts.edu')).toHaveLength(0);
    expect(named('Resend the invite to robin.assistant@tufts.edu')).toHaveLength(0);
    expect(named('Revoke the invite to assistant.coach@tufts.edu')).toHaveLength(1);
    for (const email of ['jamie.cole', 'alex.moore', 'robin.assistant']) {
      expect(named(`Revoke the invite to ${email}@tufts.edu`), email).toHaveLength(0);
    }
  });

  it('resends, revokes, removes and invites through the right endpoints', async () => {
    const writes = fakeApi();
    const sheet = await openCoaches();

    fireEvent.click(button(sheet, 'Resend the invite to assistant.coach@tufts.edu'));
    await settled(sheet, 'Resend the invite to assistant.coach@tufts.edu');
    fireEvent.click(button(sheet, 'Revoke the invite to assistant.coach@tufts.edu'));
    await settled(sheet, 'Revoke the invite to assistant.coach@tufts.edu');
    fireEvent.click(button(sheet, 'Remove Robin Assistant as a coach'));
    await settled(sheet, 'Remove Robin Assistant as a coach');
    fireEvent.change(sheet.getByLabelText('Invite a coach by email'), {
      target: { value: 'new.coach@tufts.edu' },
    });
    fireEvent.click(button(sheet, 'Send invite'));
    await waitFor(() => expect(writes).toHaveLength(4));

    expect(writes).toEqual([
      { method: 'POST', path: `/staff/coach-invites/${pending.id}/resend` },
      { method: 'POST', path: `/staff/coach-invites/${pending.id}/revoke` },
      { method: 'DELETE', path: `/teams/${soccer.id}/members/${robin.id}` },
      {
        method: 'POST',
        path: `/staff/teams/${soccer.id}/coach-invites`,
        body: { email: 'new.coach@tufts.edu' },
      },
    ]);
  });

  it('won’t remove a live team’s last active coach, and marks suspended coaches', async () => {
    const writes = fakeApi({
      coaches: { coaches: [coach(dana), coach(robin, true)], invites: [] },
    });
    const sheet = await openCoaches();
    expect(sheet.getByText('Suspended')).toBeTruthy();
    const removeDana = button(sheet, 'Remove Dana Rivera as a coach');
    expect(removeDana.disabled).toBe(true);
    fireEvent.click(removeDana);
    expect(writes).toEqual([]);

    // The disabled button says why, for screen readers too.
    const describedBy = removeDana.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const why = document.getElementById(describedBy!)?.textContent ?? '';
    expect(why).toMatch(/A live team always keeps at least one coach/);
    expect(why).toMatch(/Add another/);

    // The suspended coach can be removed; that's the only request sent.
    const removeRobin = button(sheet, 'Remove Robin Assistant as a coach');
    expect(removeRobin.disabled).toBe(false);
    expect(removeRobin.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(removeRobin);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes).toEqual([{ method: 'DELETE', path: `/teams/${soccer.id}/members/${robin.id}` }]);
  });

  it('lets staff remove the only coach of a team that isn’t live', async () => {
    const writes = fakeApi({ coaches: { coaches: [coach(dana)], invites: [] } });
    render(<TeamsPage />);
    fireEvent.click(await screen.findByRole('button', { name: "Coaches of Men's Lacrosse" }));
    const sheet = dialog("Men's Lacrosse: coaches");
    const remove = (await sheet.findByRole('button', {
      name: 'Remove Dana Rivera as a coach',
    })) as HTMLButtonElement;
    expect(remove.disabled).toBe(false);
    expect(remove.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(remove);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes).toEqual([
      { method: 'DELETE', path: `/teams/${lacrosse.id}/members/${dana.id}` },
    ]);
  });

  it('hides resending and inviting on an archived team', async () => {
    fakeApi({ coaches: { coaches: [coach(dana)], invites: [pending, expired] } });
    render(<TeamsPage />);
    fireEvent.click(await screen.findByRole('button', { name: "Coaches of Men's Lacrosse" }));
    const sheet = dialog("Men's Lacrosse: coaches");
    // The invites are still listed, with their dates...
    expect(await sheet.findByText('assistant.coach@tufts.edu · Pending')).toBeTruthy();
    expect(sheet.getByText('jamie.cole@tufts.edu · Expired')).toBeTruthy();
    // ...but nothing new can go out until the team is restored.
    expect(sheet.queryAllByRole('button', { name: /^Resend/ })).toEqual([]);
    expect(sheet.queryByLabelText('Invite a coach by email')).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Send invite' })).toBeNull();
  });

  it('lets the last coach go when there is another active one', async () => {
    fakeApi({ coaches: { coaches: [coach(dana), coach(robin)], invites: [] } });
    const sheet = await openCoaches();
    expect(button(sheet, 'Remove Dana Rivera as a coach').disabled).toBe(false);
    expect(sheet.queryByText('Suspended')).toBeNull();
  });
});

describe('staff teams page: archiving and restoring', () => {
  it('asks before archiving, and archives only once confirmed', async () => {
    const writes = fakeApi();
    render(<TeamsPage />);
    fireEvent.click(await screen.findByRole('button', { name: "Archive Women's Soccer" }));
    const sheet = dialog("Archive Women's Soccer?");
    expect(sheet.getByText(/leaves the join search/)).toBeTruthy();
    // Opening the question sends nothing (the one write asserted at the end confirms it).
    expect(writes).toEqual([]);

    // Backing out sends nothing.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: "Archive Women's Soccer?" })).toBeNull(),
    );
    expect(writes).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: "Archive Women's Soccer" }));
    fireEvent.click(button(dialog("Archive Women's Soccer?"), 'Archive team'));
    await waitFor(() => expect(writes).toHaveLength(1));
    const [write] = writes;
    const viaAction =
      write!.method === 'POST' && write!.path === `/staff/teams/${soccer.id}/archive`;
    const viaEdit =
      write!.method === 'PATCH' &&
      write!.path === `/staff/teams/${soccer.id}` &&
      (write!.body as { archived?: boolean }).archived === true;
    expect(viaAction || viaEdit, JSON.stringify(write)).toBe(true);
  });

  it('restores an archived team', async () => {
    const writes = fakeApi();
    render(<TeamsPage />);
    fireEvent.click(await screen.findByRole('button', { name: "Restore Men's Lacrosse" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PATCH',
      path: `/staff/teams/${lacrosse.id}`,
      body: { archived: false },
    });
  });
});
