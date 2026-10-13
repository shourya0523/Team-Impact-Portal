import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useRole } from '@/navigation/role';
import { TABS_BY_ROLE, type TabName } from '@/navigation/tabs';
import { colors, spacing, typography } from '@team-impact/ui-tokens';
import { fontFor, Icon, type IconName } from '@/ui';

// Every tab in the app, in tab-bar order. Each role only sees the ones TABS_BY_ROLE allows.
const ALL_TABS: { name: TabName; title: string; icon: IconName }[] = [
  { name: 'home', title: 'Home', icon: 'home' },
  { name: 'events', title: 'Events', icon: 'calendar' },
  { name: 'team', title: 'Team', icon: 'users' },
  { name: 'child', title: 'Child', icon: 'child' }, // parent only: the wireframe labels it with the child's name
  { name: 'card', title: 'Card', icon: 'card' },
  { name: 'review', title: 'Review', icon: 'swipe' },
  { name: 'lists', title: 'Lists', icon: 'list' },
  { name: 'me', title: 'Me', icon: 'user' },
];

/** The signed-in tab bar. `(app)` is a group, so its screens keep clean URLs like /home. */
export default function AppTabs() {
  const { role } = useRole();
  if (!role) return <Redirect href="/welcome" />; // not signed in → back to the landing page

  const allowed = TABS_BY_ROLE[role] ?? [];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.lineSoft,
          height: 84,
          paddingTop: spacing.sm,
        },
        tabBarLabelStyle: {
          fontFamily: fontFor('semibold'),
          fontSize: typography.caption.fontSize,
        },
      }}
    >
      {ALL_TABS.map((tab) => (
        // guard={false} hides the tab AND blocks its URL for this role.
        <Tabs.Protected key={tab.name} guard={allowed.includes(tab.name)}>
          <Tabs.Screen
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, focused }) => (
                <Icon
                  name={tab.icon}
                  size={24}
                  color={String(color)}
                  fill={focused ? colors.brandTint : 'none'}
                />
              ),
            }}
          />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
