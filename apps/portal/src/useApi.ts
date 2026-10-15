import { useCallback, useEffect, useState } from 'react';

export type Loadable<T> =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

/**
 * Loads once per change of `deps` and exposes `reload` for after a write. Deliberately tiny: the
 * shell only reads, and a query library can replace it once screens need caching.
 */
export const useApi = <T>(load: () => Promise<T>, deps: unknown[] = []) => {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  const run = useCallback(load, deps);

  const reload = useCallback(() => {
    let live = true;
    run().then(
      (data) => live && setState({ status: 'ready', data }),
      (error: Error) => live && setState({ status: 'error', error }),
    );
    return () => {
      live = false;
    };
  }, [run]);

  useEffect(reload, [reload]);
  return { state, reload };
};
