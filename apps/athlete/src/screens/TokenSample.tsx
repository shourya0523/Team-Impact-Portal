import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { sampleTeams } from '../fixtures/teams';
import { Badge, Button, Card, FadeSlideIn, Input, Sheet, TeamAvatar, Text } from '../ui';

/** Sample screen: every Signing Day token on one page. Real screens replace it in later tickets. */
export function TokenSample() {
  const [open, setOpen] = useState(false);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FadeSlideIn>
        <Text variant="eyebrow" color="secondary">
          Signing Day
        </Text>
        <Text variant="display" size="xl">
          All in. All together.
        </Text>
      </FadeSlideIn>
      <FadeSlideIn delay={80}>
        <Text variant="body" color="secondary">
          Find your team, request to join, and get signed. Body text is Barlow 16 on the ground
          colour.
        </Text>
      </FadeSlideIn>
      <FadeSlideIn delay={160}>
        <Card>
          <View style={styles.row}>
            <TeamAvatar name="Austin Hawks" teamColor={sampleTeams.hawks} size="lg" />
            <TeamAvatar name="Rookie Squad" size="lg" />
            <Badge label="Pending" variant="warning" />
          </View>
          <Text variant="small" color="muted">
            Team avatars take a runtime team colour and default to brand.
          </Text>
          <Input label="Join code" placeholder="e.g. HAWK-24" />
          <Button label="Request to join" size="lg" onPress={() => setOpen(true)} />
          <Button label="Not now" variant="secondary" />
        </Card>
      </FadeSlideIn>
      <Sheet visible={open} title="Request sent" onClose={() => setOpen(false)}>
        <Text variant="body" color="secondary">
          A coach will review it.
        </Text>
        <Button label="Done" onPress={() => setOpen(false)} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: spacing.md,
    paddingTop: spacing['3xl'],
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
