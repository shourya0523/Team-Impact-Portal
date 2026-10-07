import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const subscribe = (onChange: () => void) => {
  if (!supported()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

/**
 * True when the OS asks for reduced motion. When true: no stamp, no tilt, no shine, and movement
 * becomes a fade.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => supported() && window.matchMedia(QUERY).matches,
    () => false,
  );
}
