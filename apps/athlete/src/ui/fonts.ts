import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { useFonts } from 'expo-font';
import { fontWeight } from '@team-impact/ui-tokens';

/**
 * Native font family names are per weight (Android ignores `fontWeight` on custom fonts), so the
 * token weights map to the names the Google Font packages register.
 */
export const nativeFont = {
  display: 'BarlowCondensed_800ExtraBold',
  [fontWeight.regular]: 'Barlow_400Regular',
  [fontWeight.medium]: 'Barlow_500Medium',
  [fontWeight.semibold]: 'Barlow_600SemiBold',
} as const;

/** Loads Barlow Condensed 800 and Barlow 400/500/600. Render nothing until it returns true. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    BarlowCondensed_800ExtraBold,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
  });
  // A font failure should not brick the app; system fonts are an acceptable fallback.
  return loaded || error !== null;
}
