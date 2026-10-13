import { RoleProvider } from '@/navigation/role';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Root layout. GestureHandlerRootView must stay at the very top: the athlete card's swipe (and any
 * future gesture) needs it.
 *
 * TODO(app shell): add the session provider and guarded (auth)/(app) groups from the routing guide.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RoleProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </RoleProvider>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
