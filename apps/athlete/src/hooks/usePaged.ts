import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Page } from '@/api/client';
import type { Loadable } from './useApi';
import { canLoadMore, initialPaged, pagedReducer, restartsList } from './paged';

/**
 * A cursor-paged list (the home feed, a community's posts), loaded a page at a time. `state` is the
 * first page as a `Loadable`, so `<Async>` works as with `useApi`; after that, `loadMore` appends
 * the next page (FlatList `onEndReached`), `refresh` starts again from page 1 (pull to refresh),
 * and `remove` drops items on the device. The state logic and its tests are in `./paged.ts`.
 */
export const usePaged = <T extends { id: string }>(
  load: (cursor?: string) => Promise<Page<T>>,
  deps: unknown[] = [],
) => {
  const [s, dispatch] = useReducer(pagedReducer<T>, undefined, initialPaged<T>);
  const fetchPage = useCallback(load, deps);
  const runs = useRef(0);
  /** The run whose next page is on its way, so a fast scroll can't ask twice. */
  const inFlight = useRef(0);

  const fromFirst = useCallback(
    (type: 'start' | 'refresh') => {
      const run = ++runs.current;
      dispatch({ type, run });
      fetchPage().then(
        (page) => dispatch({ type: 'loaded', run, page, append: false }),
        (error: Error) => dispatch({ type: 'failed', run, error, append: false }),
      );
    },
    [fetchPage],
  );

  useEffect(() => fromFirst('start'), [fromFirst]);

  const more = (retrying: boolean) => {
    const current = retrying ? { ...s, failure: null } : s;
    if (!canLoadMore(current) || inFlight.current === runs.current) return;
    const run = runs.current;
    inFlight.current = run;
    dispatch({ type: 'more' });
    fetchPage(current.nextCursor!)
      .then(
        (page) => dispatch({ type: 'loaded', run, page, append: true }),
        (error: Error) => {
          if (run !== runs.current) return;
          if (restartsList(error)) fromFirst('refresh');
          else dispatch({ type: 'failed', run, error, append: true });
        },
      )
      .finally(() => {
        if (inFlight.current === run) inFlight.current = 0;
      });
  };

  const state: Loadable<T[]> =
    s.first.status === 'ready' ? { status: 'ready', data: s.items } : s.first;

  return {
    state,
    hasMore: s.nextCursor !== null,
    loadingMore: s.loadingMore,
    refreshing: s.refreshing,
    /** A next page or refresh that failed; the items already shown stay. */
    moreError: s.failure?.error ?? null,
    loadMore: () => more(false),
    /** Tries again whatever failed last: the next page, or the refresh. */
    retry: () => (s.failure?.during === 'refresh' ? fromFirst('refresh') : more(true)),
    refresh: () => fromFirst('refresh'),
    remove: (drop: (item: T) => boolean) => dispatch({ type: 'remove', drop }),
  };
};
