import { router, Stack, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Button, Text, View } from 'react-native';

export interface PlaceholderLink {
  label: string;
  href: Href;
  /** Swap the current screen instead of stacking on top (for "done" / "enter app" steps). */
  replace?: boolean;
}

/**
 * A placeholder screen: its name, the hi-fi wireframe board it stands for, and one button per
 * place that board navigates to. Feature tickets replace these with the real screens.
 */
export function Placeholder({
  title,
  wireframe,
  links = [],
  children,
}: {
  title: string;
  wireframe?: string;
  links?: PlaceholderLink[];
  children?: ReactNode;
}) {
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Stack.Screen options={{ title }} />
      <Text>{title}</Text>
      {wireframe && <Text>Wireframe: {wireframe}</Text>}
      {children}
      {links.map((link) => (
        <Button
          key={link.label}
          title={link.label}
          // withAnchor: when a button jumps into another tab, load that tab's main screen beneath it.
          onPress={() =>
            link.replace
              ? router.replace(link.href, { withAnchor: true })
              : router.push(link.href, { withAnchor: true })
          }
        />
      ))}
    </View>
  );
}
