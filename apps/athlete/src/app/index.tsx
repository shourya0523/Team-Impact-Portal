import { Redirect } from 'expo-router';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';

/**
 * "/" entry: signed in → the role's first tab, otherwise the landing page. `pnpm demo:card` sets
 * EXPO_PUBLIC_DEMO=card, which opens the card demo straight away.
 */
export default function Index() {
  const { role, ready } = useRole();
  if (!ready) return null;
  if (process.env.EXPO_PUBLIC_DEMO === 'card') return <Redirect href="/dev/card-demo" />;
  return <Redirect href={role ? firstTab(role) : '/welcome'} />;
}
