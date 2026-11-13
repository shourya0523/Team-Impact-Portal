import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * A post was written somewhere else (compose), so feeds already mounted under the tab stack are out
 * of date. A new post usually ranks above the cursor they're paging from, so scrolling never brings
 * it in; they refresh when next focused instead. Not on every focus: a refresh goes back to page 1,
 * which would lose your place each time you came back from a post.
 */
let version = 0;

export const markPostsChanged = () => {
  version++;
};

/** Calls `refresh` when this screen is focused after a post was written since it last looked. */
export const useRefreshOnPostsChanged = (refresh: () => void) => {
  const seen = useRef(version);
  useFocusEffect(
    useCallback(() => {
      if (seen.current === version) return;
      seen.current = version;
      refresh();
    }, [refresh]),
  );
};
