import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RoleProvider } from '@/navigation/role';
import { useAppFonts } from '@/ui';

/**
 * Root layout. GestureHandlerRootView must stay at the very top: the athlete card's swipe (and any
 * future gesture) needs it. Screens wait for the brand fonts (Barlow Condensed 800, Barlow
 * 400/500/600) so headlines never flash in a fallback face.
 */
export default function RootLayout() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RoleProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </RoleProvider>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
