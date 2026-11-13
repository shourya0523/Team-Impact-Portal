import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementsPage } from './Announcements';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A fake API that records each announcement and answers with an empty "Posted" list. */
const fakeApi = () => {
  const writes: unknown[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      if (path !== '/staff/announcements') return json({ error: { message: path } }, 404);
      if (init?.method !== 'POST') return json([]);
      writes.push(JSON.parse(init.body as string));
      return json({}, 201);
    }),
  );
  return writes;
};

describe('Announcements page', () => {
  it('always goes to everyone: no community to pick', () => {
    fakeApi();
    render(<AnnouncementsPage />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(/Goes to everyone on Team Impact/)).toBeTruthy();
  });

  it('sends the text and the push choice, and nothing else', async () => {
    const writes = fakeApi();
    render(<AnnouncementsPage />);
    fireEvent.change(screen.getByLabelText('Announcement'), {
      target: { value: 'Draft day applications are open.' },
    });
    fireEvent.click(screen.getByLabelText('Also send a push notification'));
    fireEvent.click(screen.getByRole('button', { name: 'Post announcement' }));
    await waitFor(() =>
      expect(writes).toEqual([{ text: 'Draft day applications are open.', sendPush: false }]),
    );
  });
});
