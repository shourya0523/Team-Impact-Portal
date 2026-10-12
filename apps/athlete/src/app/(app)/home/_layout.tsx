import { Stack } from 'expo-router';

// Keep this tab's main screen (index) underneath any screen opened directly, e.g. from another
// tab or a deep link, so Back and re-pressing the tab return to it.
export const unstable_settings = { anchor: 'index' };

/** Screens opened from this tab stack on top of it, with a back button. */
export default function TabStack() {
  return <Stack />;
}
