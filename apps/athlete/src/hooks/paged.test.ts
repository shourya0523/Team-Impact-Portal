import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/client';
import {
  canLoadMore,
  createPagedLoader,
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

  it('keeps the posts shown on a restart but drops the refused cursor', () => {
    const s = reduce(...loaded(['p1', 'p2']), { type: 'restart', run: 2 });
    expect(s.refreshing).toBe(true);
    expect(ids(s)).toEqual(['p1', 'p2']);
    expect(s.nextCursor).toBeNull();
    expect(canLoadMore({ ...s, refreshing: false })).toBe(false);
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

  it('keeps paging after a failed refresh, from the cursor already shown', () => {
    const error = new Error('offline');
    const failed = reduce(
      ...loaded(['p1']),
      { type: 'refresh', run: 2 },
      { type: 'failed', run: 2, error, append: false },
    );
    expect(canLoadMore(failed)).toBe(true);
    const s = [
      { type: 'more' } as const,
      { type: 'loaded', run: 2, page: page(['p2']), append: true } as const,
    ].reduce(pagedReducer<Item>, failed);
    expect(ids(s)).toEqual(['p1', 'p2']);
    // The refresh still didn't work, so its note stays up until one does.
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

const apiError = (status: number, code: 'bad_request' | 'validation_error' = 'bad_request') =>
  new ApiRequestError(status, { error: { code, message: 'Invalid cursor.' } });

describe('restartsList', () => {
  it('restarts on a cursor the server refused', () => {
    expect(restartsList(apiError(400))).toBe(true);
  });

  it('shows anything else as an error, other 400s included, so they can’t loop', () => {
    expect(restartsList(apiError(400, 'validation_error'))).toBe(false);
    expect(restartsList(apiError(500))).toBe(false);
    expect(restartsList(apiError(403))).toBe(false);
    expect(restartsList(new TypeError('Network request failed'))).toBe(false);
  });
});

/** A promise settled by hand, so a test decides which response lands first. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * The loader over the real reducer, with every `load` call held until the test settles it. While
 * `lagging` is set, the loader reads the state from before the latest dispatches, as `usePaged`
 * does until React re-renders.
 */
const harness = () => {
  let state = initialPaged<Item>();
  let rendered: Paged<Item> | null = null;
  const calls: { cursor?: string; reply: ReturnType<typeof deferred<Page>> }[] = [];
  const loader = createPagedLoader<Item>({
    load: (cursor) => {
      const reply = deferred<Page>();
      calls.push({ cursor, reply });
      return reply.promise;
    },
    dispatch: (action) => {
      state = pagedReducer(state, action);
    },
    state: () => rendered ?? state,
  });
  /** Lets settled promises run their callbacks. */
  const flush = () => new Promise((r) => setTimeout(r, 0));
  /** From now until `render`, the loader sees the state as it is now. */
  const lag = () => {
    rendered = state;
  };
  const render = () => {
    rendered = null;
  };
  return { loader, calls, flush, lag, render, state: () => state };
};
type Page = ReturnType<typeof page>;

describe('createPagedLoader', () => {
  /** Page 1 (p1, p2) in, with a cursor for more. */
  const started = async () => {
    const h = harness();
    h.loader.fromFirst('start');
    h.calls[0]!.reply.resolve(page(['p1', 'p2'], 'c1'));
    await h.flush();
    return h;
  };

  it('asks for a next page once, however fast the list scrolls', async () => {
    const h = await started();
    h.loader.more(false);
    h.loader.more(false);
    h.loader.more(false);
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, 'c1']);
    h.calls[1]!.reply.resolve(page(['p3']));
    await h.flush();
    expect(ids(h.state())).toEqual(['p1', 'p2', 'p3']);
  });

  it('starts over from page 1 when the server refuses the cursor', async () => {
    const h = await started();
    h.loader.more(false);
    h.calls[1]!.reply.reject(apiError(400));
    await h.flush();
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, 'c1', undefined]);
    expect(h.state().refreshing).toBe(true);
    expect(h.state().failure).toBeNull();
    expect(h.state().nextCursor).toBeNull();
    h.calls[2]!.reply.resolve(page(['p9'], 'c2'));
    await h.flush();
    expect(ids(h.state())).toEqual(['p9']);
    expect(h.state().nextCursor).toBe('c2');
  });

  it('doesn’t send a refused cursor again when the restart fails', async () => {
    const h = await started();
    h.loader.more(false);
    h.calls[1]!.reply.reject(apiError(400));
    await h.flush();
    const error = new Error('offline');
    h.calls[2]!.reply.reject(error);
    await h.flush();
    expect(h.state().failure).toEqual({ error, during: 'refresh' });
    expect(ids(h.state())).toEqual(['p1', 'p2']);
    // Scrolling to the end asks for nothing; only the banner's Try again (a refresh) does.
    h.loader.more(false);
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, 'c1', undefined]);
    h.loader.fromFirst('refresh');
    expect(h.calls).toHaveLength(4);
  });

  it('shows any other 400 on a next page as an error instead of starting over', async () => {
    const h = await started();
    h.loader.more(false);
    const error = apiError(400, 'validation_error');
    h.calls[1]!.reply.reject(error);
    await h.flush();
    expect(h.calls).toHaveLength(2);
    expect(h.state().failure).toEqual({ error, during: 'more' });
    // Nothing more until retried.
    h.loader.more(false);
    expect(h.calls).toHaveLength(2);
    h.loader.more(true);
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, 'c1', 'c1']);
  });

  it('drops a next page that lands after a refresh', async () => {
    const h = await started();
    h.loader.more(false);
    h.loader.fromFirst('refresh');
    h.calls[2]!.reply.resolve(page(['p1', 'p5'], 'c9'));
    await h.flush();
    h.calls[1]!.reply.resolve(page(['old']));
    await h.flush();
    expect(ids(h.state())).toEqual(['p1', 'p5']);
    expect(h.state().nextCursor).toBe('c9');
  });

  it('drops a page from the previous chip once a new list starts', async () => {
    const h = await started();
    h.loader.more(false);
    h.loader.fromFirst('start');
    h.calls[1]!.reply.reject(new Error('offline'));
    h.calls[2]!.reply.resolve(page(['t1']));
    await h.flush();
    expect(ids(h.state())).toEqual(['t1']);
    expect(h.state().failure).toBeNull();
  });

  it('waits for the render that shows a refresh before asking for a next page', async () => {
    const h = await started();
    h.lag();
    h.loader.fromFirst('refresh');
    // Before React re-renders, the state read still has the old run and cursor c1.
    h.loader.more(false);
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, undefined]);
    h.render();
    h.calls[1]!.reply.resolve(page(['p9', 'p1'], 'c2'));
    await h.flush();
    h.loader.more(false);
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, undefined, 'c2']);
    h.calls[2]!.reply.resolve(page(['p3']));
    await h.flush();
    expect(ids(h.state())).toEqual(['p9', 'p1', 'p3']);
  });

  it('can page again in the new run while the old one’s page is still out', async () => {
    const h = await started();
    h.loader.more(false);
    h.loader.fromFirst('refresh');
    h.calls[2]!.reply.resolve(page(['p1'], 'c5'));
    await h.flush();
    h.loader.more(false);
    expect(h.calls.map((c) => c.cursor)).toEqual([undefined, 'c1', undefined, 'c5']);
  });
});
