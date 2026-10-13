import { Link, Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '@team-impact/ui-tokens';

/**
 * "/" entry. `pnpm demo:card` sets EXPO_PUBLIC_DEMO=card, which opens the card demo straight away.
 *
 * TODO(app shell): replace the placeholder with the session redirect from the routing guide
 * (signed out → /welcome, signed in → the role's first tab).
 */
export default function Index() {
  if (process.env.EXPO_PUBLIC_DEMO === 'card') return <Redirect href="/dev/card-demo" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Team Impact</Text>
      <Text style={styles.subtitle}>App shell coming soon.</Text>
      <Link href="/welcome" style={styles.link}>
        Go to landing page
      </Link>
      {__DEV__ && (
        <Link href="/dev/card-demo" style={styles.link}>
          Open card demo
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted },
  link: { fontSize: fontSize.md, color: colors.primary, marginTop: spacing.md },
});
