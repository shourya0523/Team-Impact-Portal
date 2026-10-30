import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Community, Post, UserSummary } from '@team-impact/contracts';
import { PostsPage } from './Posts';

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
const userMade = { createdBy: maya, private: false, myJoinRequest: null };

const finance = {
  ...base,
  ...userMade,
  id: id(305),
  name: 'Athletes in Finance',
  kind: 'interest',
  official: false,
  myMembership: { ...joined, recruiterSearchOptIn: false },
} as const;
const firstGen = { ...finance, id: id(304), name: 'First Gen', myMembership: null } as const;
const soccer = {
  ...base,
  id: id(301),
  name: "Tufts Women's Soccer",
  kind: 'team',
  teamId: id(201),
  myMembership: null,
} as const;
const teamImpact = {
  ...base,
  id: id(302),
  name: 'Team Impact',
  kind: 'team_impact',
  myMembership: joined,
} as const;
// Team Impact's is listed last on purpose: the page puts it first.
const COMMUNITIES: Community[] = [finance, firstGen, soccer, teamImpact];

type Write = { path: string; body: unknown };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A fake API that records each post, and answers it with `reply` (default: made). */
const fakeApi = (reply?: () => Response) => {
  const writes: Write[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  const posted: Post[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      if (path === '/communities') return json(COMMUNITIES);
      if (path === '/staff/posts') return json(posted);
      const made = /^\/communities\/([^/]+)\/posts$/.exec(path);
      if (made && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { text: string };
        writes.push({ path, body });
        if (reply) return reply();
        const c = COMMUNITIES.find((x) => x.id === made[1])!;
        const post = {
          id: id(9000 + writes.length),
          kind: 'post',
          author: maya,
          community: { id: c.id, name: c.name, kind: c.kind },
          text: body.text,
          imageUrl: null,
          official: true,
          likeCount: 0,
          commentCount: 0,
          likedByMe: false,
          moderation: 'approved',
          createdAt: new Date().toISOString(),
        } satisfies Post;
        posted.unshift(post);
        return json(post, 201);
      }
      return json({ error: { code: 'not_found', message: path } }, 404);
    }),
  );
  return writes;
};

const options = () =>
  Array.from(screen.getByLabelText<HTMLSelectElement>('Community').options).map((o) => o.text);

describe('Posts page', () => {
  it('offers only communities staff belong to, Team Impact’s first', async () => {
    fakeApi();
    render(<PostsPage />);
    await waitFor(() => expect(options()).toEqual(['Team Impact', 'Athletes in Finance']));
  });

  it('posts into the chosen community, lists it and says where it went', async () => {
    const writes = fakeApi();
    render(<PostsPage />);
    await waitFor(() => expect(options()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Community'), { target: { value: finance.id } });
    fireEvent.change(screen.getByLabelText('Post'), { target: { value: 'Resume clinic Friday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Posted to Athletes in Finance.',
    );
    expect(writes).toEqual([
      { path: `/communities/${finance.id}/posts`, body: { text: 'Resume clinic Friday' } },
    ]);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Post').value).toBe('');
    expect(await screen.findByRole('cell', { name: 'Resume clinic Friday' })).toBeTruthy();
  });

  it('shows the API’s error and keeps the text', async () => {
    fakeApi(
      () =>
        new Response(
          JSON.stringify({ error: { code: 'forbidden', message: 'You can’t post here' } }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
    );
    render(<PostsPage />);
    await waitFor(() => expect(options()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Post'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect((await screen.findByRole('alert')).textContent).toBe('You can’t post here');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Post').value).toBe('Hello');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
