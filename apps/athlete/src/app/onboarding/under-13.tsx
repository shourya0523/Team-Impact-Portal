import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@team-impact/ui-tokens';
import { Button, Icon, Text } from '@/ui';

const BADGE = 64;

/**
 * "/onboarding/under-13": children never get an account (PRD §2). A parent or guardian signs up,
 * then adds the child to their team's join request; the child's profile is run by the parent.
 */
export default function Under13() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Icon name="child" size={30} color={colors.onBrand.text} />
        </View>
        <Text variant="display" size="xxl" color="onBrand">
          A grown-up{'\n'}sets this up
        </Text>
        <Text color="onBrandSecondary">
          You need to be 13 or older for your own account. Ask your parent or guardian to sign up.
          They can add you to your team, and you’ll be on it as soon as the coach says yes.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label="I’m a parent: sign up"
          variant="onBrand"
          size="lg"
          onPress={() => router.replace('/sign-up')}
        />
        <Button
          label="Back to welcome"
          variant="ghostOnBrand"
          size="lg"
          onPress={() => router.replace('/welcome')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand, paddingHorizontal: spacing.lg },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.sm },
});
