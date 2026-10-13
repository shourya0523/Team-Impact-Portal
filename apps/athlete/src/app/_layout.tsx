import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RoleProvider } from '@/navigation/role';

/**
 * Root layout. GestureHandlerRootView must stay at the very top: the athlete card's swipe (and any
 * future gesture) needs it. Screens wait for the brand fonts so headlines never flash in a
 * fallback face.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  // On a font error, carry on with system fonts rather than a blank app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RoleProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </RoleProvider>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
