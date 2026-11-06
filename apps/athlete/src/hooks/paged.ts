import { ApiRequestError, type Page } from '../api/client';

/**
 * The state behind `usePaged`, kept free of React so it can be tested on its own. A "run" is one
 * pass through a feed from page 1: a refresh or new deps start the next run, and any response from
 * an earlier run is dropped, so a slow page can't land in the wrong list.
 */
export interface Paged<T> {
  run: number;
  /** The first page of the current list. Once ready it stays ready through refreshes. */
  first: { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready' };
  /** In the server's order: the feed is ranked there and never re-sorted here. */
  items: T[];
  nextCursor: string | null;
  loadingMore: boolean;
  /** Pull to refresh: the posts already shown stay until page 1 comes back. */
  refreshing: boolean;
  /**
   * A next page or refresh that failed; what's shown stays. A failed next page shows in the footer
   * and stops paging until retried; a failed refresh shows at the top and doesn't, since the
   * posts and cursor on screen are still good.
   */
  failure: { error: Error; during: 'more' | 'refresh' } | null;
}

export type PagedAction<T> =
  /** A new list (first mount, or deps changed): start over from nothing. */
  | { type: 'start'; run: number }
  /** Page 1 again, keeping what's shown. Before anything loaded, the same as `start`. */
  | { type: 'refresh'; run: number }
  /**
   * Page 1 again after the server refused the cursor: a refresh that also drops that cursor, so
   * if this refresh fails, paging can't send the refused cursor again and loop.
   */
  | { type: 'restart'; run: number }
  | { type: 'more' }
  | { type: 'loaded'; run: number; page: Page<T>; append: boolean }
  | { type: 'failed'; run: number; error: Error; append: boolean }
  /** Drop items on the device, e.g. a post you reported or everything by someone you blocked. */
  | { type: 'remove'; drop: (item: T) => boolean };

export const initialPaged = <T>(): Paged<T> => ({
  run: 0,
  first: { status: 'loading' },
  items: [],
  nextCursor: null,
  loadingMore: false,
  refreshing: false,
  failure: null,
});

/** A failed refresh stays on show through paging, until a refresh works. */
const keepRefreshFailure = <T>(state: Paged<T>) =>
  state.failure?.during === 'refresh' ? state.failure : null;

/** `next` after `items`, skipping any id already there. */
const append = <T extends { id: string }>(items: T[], next: T[]) => {
  const seen = new Set(items.map((x) => x.id));
  return [...items, ...next.filter((x) => !seen.has(x.id))];
};

export const pagedReducer = <T extends { id: string }>(
  state: Paged<T>,
  action: PagedAction<T>,
): Paged<T> => {
  switch (action.type) {
    case 'start':
      return { ...initialPaged<T>(), run: action.run };
    case 'refresh':
      if (state.first.status !== 'ready') return { ...initialPaged<T>(), run: action.run };
      return { ...state, run: action.run, refreshing: true, loadingMore: false, failure: null };
    case 'restart':
      return { ...pagedReducer(state, { type: 'refresh', run: action.run }), nextCursor: null };
    case 'more':
      return { ...state, loadingMore: true, failure: keepRefreshFailure(state) };
    case 'loaded':
      if (action.run !== state.run) return state;
      return {
        ...state,
        first: { status: 'ready' },
        items: append(action.append ? state.items : [], action.page.items),
        nextCursor: action.page.nextCursor,
        loadingMore: false,
        refreshing: false,
        // A next page landing doesn't mean the refresh worked.
        failure: action.append ? keepRefreshFailure(state) : null,
      };
    case 'failed':
      if (action.run !== state.run) return state;
      if (action.append) {
        return { ...state, loadingMore: false, failure: { error: action.error, during: 'more' } };
      }
      if (state.refreshing) {
        return { ...state, refreshing: false, failure: { error: action.error, during: 'refresh' } };
      }
      return { ...state, first: { status: 'error', error: action.error } };
    case 'remove':
      return { ...state, items: state.items.filter((x) => !action.drop(x)) };
  }
};

/**
 * Whether a next page can be asked for now: one at a time, not while refreshing, and not over a
 * failed next page until it's retried. A failed refresh doesn't stop it.
 */
export const canLoadMore = <T>(state: Paged<T>) =>
  state.first.status === 'ready' &&
  state.nextCursor !== null &&
  !state.loadingMore &&
  !state.refreshing &&
  state.failure?.during !== 'more';

/**
 * A next page the server refused as `bad_request`: the cursor isn't one it issued
 * (`apps/api/src/mock/feed.ts`), so start again from page 1 instead of showing an error. Other 400s
 * (`validation_error`) would fail again from page 1 too, so they show as errors instead of looping.
 */
export const restartsList = (error: unknown) =>
  error instanceof ApiRequestError &&
  error.status === 400 &&
  error.body.error.code === 'bad_request';

/**
 * What `usePaged` does between the reducer and the network, kept out of React so it can be tested
 * with a fake `load`. `state` reads the latest state; run ids keep counting for the loader's life,
 * so a late page from an earlier run (a refresh, another chip) never matches the current one.
 */
export const createPagedLoader = <T extends { id: string }>({
  load,
  dispatch,
  state,
}: {
  load: (cursor?: string) => Promise<Page<T>>;
  dispatch: (action: PagedAction<T>) => void;
  state: () => Paged<T>;
}) => {
  let runs = 0;
  /** The run whose next page is on its way, so a fast scroll can't ask twice. */
  let inFlight = 0;

  const fromFirst = (type: 'start' | 'refresh' | 'restart') => {
    const run = ++runs;
    dispatch({ type, run });
    load().then(
      (page) => dispatch({ type: 'loaded', run, page, append: false }),
      (error: Error) => dispatch({ type: 'failed', run, error, append: false }),
    );
  };

  const more = (retrying: boolean) => {
    const s = state();
    const current = retrying ? { ...s, failure: null } : s;
    if (!canLoadMore(current) || inFlight === runs) return;
    const run = runs;
    inFlight = run;
    dispatch({ type: 'more' });
    return load(current.nextCursor!)
      .then(
        (page) => dispatch({ type: 'loaded', run, page, append: true }),
        (error: Error) => {
          if (run !== runs) return;
          if (restartsList(error)) fromFirst('restart');
          else dispatch({ type: 'failed', run, error, append: true });
        },
      )
      .finally(() => {
        if (inFlight === run) inFlight = 0;
      });
  };

  return { fromFirst, more };
};
