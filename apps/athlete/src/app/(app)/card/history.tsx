import { StyleSheet, View } from 'react-native';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { entryText } from '@/components/cardData';
import { shortDate } from '@/components/format';
import { Async, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Badge, Card, Text } from '@/ui';

/** "/card/history": every card the athlete published, grouped by season. Only they see these. */
export default function CardHistory() {
  const { state } = useApi(() => api.cardHistory());
  return (
    <Screen eyebrow="Baseball Card" title="Earlier seasons" back>
      <Async state={state}>
        {(versions) =>
          versions.length === 0 ? (
            <Gutter>
              <Text color="secondary">Publish your card and each version shows up here.</Text>
            </Gutter>
          ) : (
            [...new Set(versions.map((v) => v.season))].map((season) => (
              <View key={season} style={styles.season}>
                <SectionLabel>{`Season ${season}`}</SectionLabel>
                <Gutter gap="sm">
                  {versions
                    .filter((v) => v.season === season)
                    .map((v, i) => (
                      <Card key={`${v.season}-${v.version}`}>
                        <View style={styles.between}>
                          <Text weight="semibold">Version {v.version}</Text>
                          {i === 0 && season === versions[0]?.season ? (
                            <Badge caps variant="success" label="Current" />
                          ) : (
                            <Badge label={`Published ${shortDate(v.publishedAt)}`} />
                          )}
                        </View>
                        <Text variant="small" color="secondary">
                          {[v.face.position, v.face.major, `Class of ${v.face.classYear}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        {v.face.experience.map((e, n) => (
                          <Text key={`${n}-${e.role}`} variant="small">
                            {entryText(e)}
                          </Text>
                        ))}
                        {v.face.skills.length > 0 && (
                          <Text variant="caption" color="muted">
                            {v.face.skills.join(' · ')}
                          </Text>
                        )}
                      </Card>
                    ))}
                </Gutter>
              </View>
            ))
          )
        }
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  season: { gap: spacing.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
