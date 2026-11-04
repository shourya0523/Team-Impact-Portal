import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Page } from '@/api/client';
import type { Loadable } from './useApi';
import { createPagedLoader, initialPaged, pagedReducer } from './paged';

/**
 * A cursor-paged list (the home feed, a community's posts), loaded a page at a time. `state` is the
 * first page as a `Loadable`, so `<Async>` works as with `useApi`; after that, `loadMore` appends
 * the next page (FlatList `onEndReached`), `refresh` starts again from page 1 (pull to refresh),
 * and `remove` drops items on the device. The state logic, the loader and their tests are in
 * `./paged.ts`.
 */
export const usePaged = <T extends { id: string }>(
  load: (cursor?: string) => Promise<Page<T>>,
  deps: unknown[] = [],
) => {
  const [s, dispatch] = useReducer(pagedReducer<T>, undefined, initialPaged<T>);
  const fetchPage = useCallback(load, deps);
  // The loader lives as long as the screen, so run ids keep counting across chips and refreshes;
  // it reads the latest `load` and state through refs.
  const latest = useRef({ fetchPage, s });
  latest.current = { fetchPage, s };
  const [loader] = useState(() =>
    createPagedLoader<T>({
      load: (cursor) => latest.current.fetchPage(cursor),
      dispatch,
      state: () => latest.current.s,
    }),
  );

  useEffect(() => loader.fromFirst('start'), [loader, fetchPage]);

  const refresh = useCallback(() => loader.fromFirst('refresh'), [loader]);
  const state: Loadable<T[]> =
    s.first.status === 'ready' ? { status: 'ready', data: s.items } : s.first;

  return {
    state,
    hasMore: s.nextCursor !== null,
    /** Every page is in and there was something to show: the end of the list. */
    caughtUp: s.first.status === 'ready' && s.items.length > 0 && s.nextCursor === null,
    loadingMore: s.loadingMore,
    refreshing: s.refreshing,
    /** A next page or refresh that failed, and which; the items already shown stay. */
    failure: s.failure,
    loadMore: () => void loader.more(false),
    /** Tries the next page again after it failed. */
    retryMore: () => void loader.more(true),
    /** Stable, so it can sit in a focus effect's deps. */
    refresh,
    remove: (drop: (item: T) => boolean) => dispatch({ type: 'remove', drop }),
  };
};
