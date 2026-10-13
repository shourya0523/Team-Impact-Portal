import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useRole } from '@/navigation/role';
import { TABS_BY_ROLE, type TabName } from '@/navigation/tabs';

// Every tab in the app, in tab-bar order. Each role only sees the ones TABS_BY_ROLE allows.
const ALL_TABS: { name: TabName; title: string }[] = [
  { name: 'home', title: 'Home' },
  { name: 'events', title: 'Events' },
  { name: 'team', title: 'Team' },
  { name: 'child', title: 'Child' }, // parent only: the wireframe labels it with the child's name
  { name: 'card', title: 'Card' },
  { name: 'review', title: 'Review' },
  { name: 'lists', title: 'Lists' },
  { name: 'me', title: 'Me' },
];

/** The signed-in tab bar. `(app)` is a group, so its screens keep clean URLs like /home. */
export default function AppTabs() {
  const { role } = useRole();
  if (!role) return <Redirect href="/welcome" />; // not signed in → back to the landing page

  const allowed = TABS_BY_ROLE[role] ?? [];
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {ALL_TABS.map((tab) => (
        // guard={false} hides the tab AND blocks its URL for this role.
        <Tabs.Protected key={tab.name} guard={allowed.includes(tab.name)}>
          <Tabs.Screen name={tab.name} options={{ title: tab.title }} />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
