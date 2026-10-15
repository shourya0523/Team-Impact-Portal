import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackEventRequest } from '@team-impact/contracts';
import { track } from './client';

const ID = '7f1d6a2e-3b4c-4d5e-8f60-123456789abc';
const view: TrackEventRequest = { name: 'card.viewed', properties: { cardId: ID }, subjectId: ID };

/** Lets the fire-and-forget request settle, so an unhandled rejection would fail the test. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('track', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the event to the API', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetch);
    track(view);
    await settle();
    expect(fetch).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(view) }),
    );
  });

  it('drops failures instead of throwing', async () => {
    const error = { error: { code: 'unauthenticated', message: 'Sign in first.' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => error }),
    );
    expect(() => track(view)).not.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(() => track(view)).not.toThrow();
    await settle();
  });
});
