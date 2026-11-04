import { router } from 'expo-router';
import { Text as RNText, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@team-impact/ui-tokens';
import { Button, Logo, Text } from '@/ui';

/** "/welcome": the landing page every user starts from. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Logo size="md" variant="dark" />
      <View style={styles.hero}>
        <Text variant="display" size="xxl" color="onBrand">
          Your team.{'\n'}
          {/* A plain nested span: it inherits the headline's type, and stays inside one heading. */}
          <RNText style={styles.accent}>Your people.</RNText>
        </Text>
        <Text color="onBrandSecondary">
          The Team IMPACT app keeps teams, families and coaches together, and gives every athlete a
          Impact Card.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Create an account" size="lg" onPress={() => router.push('/sign-up')} />
        <Button
          label="Scan a team QR code"
          variant="ghostOnBrand"
          icon="qr"
          size="lg"
          onPress={() => router.push('/scan')}
        />
        {__DEV__ && (
          <View style={styles.dev}>
            <Button
              label="Mock sign-in"
              variant="onBrand"
              size="sm"
              onPress={() => router.push('/dev-sign-in')}
            />
            <View style={styles.row}>
              <Button
                label="Card demo"
                variant="ghostOnBrand"
                size="sm"
                stretch
                onPress={() => router.push('/dev/card-demo')}
              />
              <Button
                label="Tokens"
                variant="ghostOnBrand"
                size="sm"
                stretch
                onPress={() => router.push('/dev/tokens')}
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.brand },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md },
  // Pale action tint keeps the red accent while staying AA on navy (8.4:1).
  accent: { color: colors.actionTint },
  actions: { gap: spacing.sm },
  dev: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
});
