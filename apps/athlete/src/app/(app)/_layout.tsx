import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { api } from '@/api';
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
  const { role, me, ready } = useRole();
  const mustAcceptTerms = useMustAcceptTerms(me?.id ?? role);
  if (!ready) return null; // still asking the API whether there's a session
  if (!role) return <Redirect href="/welcome" />; // not signed in → back to the landing page
  if (mustAcceptTerms === null) return null; // still asking whether the terms changed
  // The legal text changed since they last agreed: nothing else until they accept it (TI-107).
  if (mustAcceptTerms) return <Redirect href="/terms-update" />;

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

/**
 * Asks the API, once per signed-in account, whether the terms changed since they accepted them.
 * Null while asking. If the API can't say (offline, or an older mock), the app carries on: the
 * API still refuses a stale version where one is sent.
 */
function useMustAcceptTerms(account: string | null): boolean | null {
  const [answer, setAnswer] = useState<{ account: string; must: boolean } | null>(null);
  useEffect(() => {
    if (!account) return;
    let live = true;
    api.termsStatus().then(
      (status) => live && setAnswer({ account, must: status.mustAccept }),
      () => live && setAnswer({ account, must: false }),
    );
    return () => {
      live = false;
    };
  }, [account]);
  return answer && answer.account === account ? answer.must : null;
}
