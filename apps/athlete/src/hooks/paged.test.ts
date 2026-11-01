import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/client';
import {
  canLoadMore,
  initialPaged,
  type Paged,
  type PagedAction,
  pagedReducer,
  restartsList,
} from './paged';

type Item = { id: string; author: string };
const item = (id: string, author = 'a') => ({ id, author });
const page = (ids: string[], nextCursor: string | null = null) => ({
  items: ids.map((id) => item(id)),
  nextCursor,
});
const ids = (s: Paged<Item>) => s.items.map((x) => x.id);

const reduce = (...actions: PagedAction<Item>[]) =>
  actions.reduce(pagedReducer<Item>, initialPaged<Item>());

/** Run 1 with its first page loaded. */
const loaded = (ids: string[], nextCursor: string | null = 'c1') => [
  { type: 'start', run: 1 } as const,
  { type: 'loaded', run: 1, page: page(ids, nextCursor), append: false } as const,
];

describe('pagedReducer', () => {
  it('shows the first page in the order the server sent it', () => {
    const s = reduce(...loaded(['p3', 'p1', 'p2']));
    expect(s.first).toEqual({ status: 'ready' });
    expect(ids(s)).toEqual(['p3', 'p1', 'p2']);
    expect(s.nextCursor).toBe('c1');
  });

  it('appends the next page after what is shown', () => {
    const s = reduce(
      ...loaded(['p1', 'p2']),
      { type: 'more' },
      { type: 'loaded', run: 1, page: page(['p3', 'p4']), append: true },
    );
    expect(ids(s)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(s.loadingMore).toBe(false);
    expect(s.nextCursor).toBeNull();
  });

  it('skips a post that is already shown', () => {
    const s = reduce(
      ...loaded(['p1', 'p2']),
      { type: 'more' },
      { type: 'loaded', run: 1, page: page(['p2', 'p3']), append: true },
    );
    expect(ids(s)).toEqual(['p1', 'p2', 'p3']);
  });

  it('ignores a page from an earlier run', () => {
    const s = reduce(
      ...loaded(['p1']),
      { type: 'more' },
      { type: 'start', run: 2 },
      { type: 'loaded', run: 1, page: page(['old']), append: true },
    );
    expect(s.first).toEqual({ status: 'loading' });
    expect(s.items).toEqual([]);
  });

  it('ignores a failure from an earlier run', () => {
    const s = reduce(
      ...loaded(['p1']),
      { type: 'refresh', run: 2 },
      {
        type: 'failed',
        run: 1,
        error: new Error('late'),
        append: true,
      },
    );
    expect(s.failure).toBeNull();
    expect(s.refreshing).toBe(true);
  });

  it('keeps the posts shown while refreshing, then replaces them with page 1', () => {
    const refreshing = reduce(...loaded(['p1', 'p2']), { type: 'refresh', run: 2 });
    expect(refreshing.refreshing).toBe(true);
    expect(ids(refreshing)).toEqual(['p1', 'p2']);

    const s = pagedReducer(refreshing, {
      type: 'loaded',
      run: 2,
      page: page(['p9', 'p1'], 'c2'),
      append: false,
    });
    expect(ids(s)).toEqual(['p9', 'p1']);
    expect(s.refreshing).toBe(false);
    expect(s.nextCursor).toBe('c2');
  });

  it('starts over when refreshing before anything loaded', () => {
    const s = reduce(
      { type: 'start', run: 1 },
      { type: 'failed', run: 1, error: new Error('offline'), append: false },
      { type: 'refresh', run: 2 },
    );
    expect(s.first).toEqual({ status: 'loading' });
    expect(s.refreshing).toBe(false);
  });

  it('shows a first-page failure as the list error', () => {
    const error = new Error('offline');
    const s = reduce({ type: 'start', run: 1 }, { type: 'failed', run: 1, error, append: false });
    expect(s.first).toEqual({ status: 'error', error });
  });

  it('keeps the posts shown when the next page fails', () => {
    const error = new Error('offline');
    const s = reduce(
      ...loaded(['p1']),
      { type: 'more' },
      {
        type: 'failed',
        run: 1,
        error,
        append: true,
      },
    );
    expect(ids(s)).toEqual(['p1']);
    expect(s.loadingMore).toBe(false);
    expect(s.failure).toEqual({ error, during: 'more' });
  });

  it('keeps the posts shown when a refresh fails', () => {
    const error = new Error('offline');
    const s = reduce(
      ...loaded(['p1']),
      { type: 'refresh', run: 2 },
      {
        type: 'failed',
        run: 2,
        error,
        append: false,
      },
    );
    expect(ids(s)).toEqual(['p1']);
    expect(s.first).toEqual({ status: 'ready' });
    expect(s.failure).toEqual({ error, during: 'refresh' });
  });

  it('clears a failure when the next page is asked for again', () => {
    const s = reduce(
      ...loaded(['p1']),
      { type: 'more' },
      { type: 'failed', run: 1, error: new Error('offline'), append: true },
      { type: 'more' },
    );
    expect(s.failure).toBeNull();
    expect(s.loadingMore).toBe(true);
  });

  it('drops a reported post on the device', () => {
    const s = reduce(...loaded(['p1', 'p2', 'p3']), { type: 'remove', drop: (x) => x.id === 'p2' });
    expect(ids(s)).toEqual(['p1', 'p3']);
  });

  it('drops every post by a blocked author on the device', () => {
    const s = reduce(
      { type: 'start', run: 1 },
      {
        type: 'loaded',
        run: 1,
        page: { items: [item('p1', 'a'), item('p2', 'b'), item('p3', 'a')], nextCursor: null },
        append: false,
      },
      { type: 'remove', drop: (x) => x.author === 'a' },
    );
    expect(ids(s)).toEqual(['p2']);
  });
});

describe('canLoadMore', () => {
  it('allows a next page once the first page is in and there is a cursor', () => {
    expect(canLoadMore(reduce(...loaded(['p1'])))).toBe(true);
  });

  it('refuses before the first page, on the last page, and while one is loading', () => {
    expect(canLoadMore(reduce({ type: 'start', run: 1 }))).toBe(false);
    expect(canLoadMore(reduce(...loaded(['p1'], null)))).toBe(false);
    expect(canLoadMore(reduce(...loaded(['p1']), { type: 'more' }))).toBe(false);
  });

  it('refuses while refreshing or after a failure, until retried', () => {
    expect(canLoadMore(reduce(...loaded(['p1']), { type: 'refresh', run: 2 }))).toBe(false);
    const failed = reduce(
      ...loaded(['p1']),
      { type: 'more' },
      {
        type: 'failed',
        run: 1,
        error: new Error('offline'),
        append: true,
      },
    );
    expect(canLoadMore(failed)).toBe(false);
    expect(canLoadMore({ ...failed, failure: null })).toBe(true);
  });
});

describe('restartsList', () => {
  const apiError = (status: number) =>
    new ApiRequestError(status, { error: { code: 'bad_request', message: 'Invalid cursor.' } });

  it('restarts on a cursor the server refused', () => {
    expect(restartsList(apiError(400))).toBe(true);
  });

  it('shows anything else as an error', () => {
    expect(restartsList(apiError(500))).toBe(false);
    expect(restartsList(apiError(403))).toBe(false);
    expect(restartsList(new TypeError('Network request failed'))).toBe(false);
  });
});
