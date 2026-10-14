import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { CARD_HEIGHT, CARD_WIDTH } from '@team-impact/ui-primitives/native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { cardPng, download } from '@/components/cardPng';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Icon, Text } from '@/ui';

const MAX_PREVIEW = 320;

/**
 * "/card/export": the published card's front as a PNG (PRD A8). The API only hands out athletes'
 * published faces, without contact details, so children and teens are never exported. Web draws
 * it on a canvas; native export needs a snapshot module and is still to come.
 */
export default function ExportCard() {
  const { width } = useWindowDimensions();
  const { state } = useApi(() => api.cardExport());
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewW = Math.min(width - spacing.md * 2, MAX_PREVIEW);

  useEffect(() => {
    if (state.status !== 'ready' || Platform.OS !== 'web') return;
    cardPng(state.data.face).then(setPng, (e: Error) => setError(e.message));
  }, [state]);

  return (
    <Screen eyebrow="Baseball Card" title="Export as image" back>
      <Async state={state}>
        {({ fileName }) => (
          <Gutter>
            {Platform.OS !== 'web' ? (
              <Card style={styles.note}>
                <Icon name="card" size={20} color={colors.brand} />
                <Text variant="small" color="secondary" style={styles.grow}>
                  Saving your card as an image works on the web app for now. It’s coming to the
                  phone app soon.
                </Text>
              </Card>
            ) : (
              <>
                <Text color="secondary">
                  The front of your published card, without your contact details. Share it anywhere.
                </Text>
                <View style={styles.center}>
                  {png ? (
                    <Image
                      source={{ uri: png }}
                      accessibilityLabel="Your Baseball Card as an image"
                      style={[
                        styles.preview,
                        { width: previewW, height: (previewW * CARD_HEIGHT) / CARD_WIDTH },
                      ]}
                    />
                  ) : (
                    !error && <Text color="secondary">Drawing your card…</Text>
                  )}
                </View>
                {error && <ErrorText>{error}</ErrorText>}
                <Button
                  label="Download PNG"
                  icon="card"
                  disabled={!png}
                  onPress={() => png && download(png, fileName)}
                />
              </>
            )}
          </Gutter>
        )}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  center: { alignItems: 'center' },
  preview: { borderRadius: radius.card },
});
