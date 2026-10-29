import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { canJoinCommunity, type Community } from '@team-impact/contracts';
import { colors, layout, radius, spacing, typography } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { creatableKinds, KIND_LABEL } from '@/components/format';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { KIND_STYLE, monogram } from '@/theme';
import { Button, Card, Icon, Text, typeStyle, type IconName } from '@/ui';

const BAND = 64;
const BADGE = 36;
const ROW_TILE = 48;

const KIND_ICON: Record<Community['kind'], IconName> = {
  team: 'users',
  team_impact: 'megaphone',
  interest: 'shield',
  medical: 'heart',
};

/** Interest and medical communities set to private at creation (PRD v2.3). */
const isPrivate = (x: Community) => (x.kind === 'interest' || x.kind === 'medical') && x.private;

const subtitle = (x: Community) => {
  const members = `${x.memberCount} members`;
  if (x.kind === 'team_impact') return 'Everyone · news';
  if (x.kind === 'team') return `Team · ${members}`;
  if (x.kind === 'medical' && x.myMembership) return 'Medical · only you see you’re in it';
  if (x.kind === 'interest' && x.official) return `Official · ${members}`;
  const kind = x.kind === 'medical' ? 'Medical' : 'Interest';
  return `${kind}${isPrivate(x) ? ' · private' : ''} · ${members}`;
};

const open = (id: string) => router.push({ pathname: '/me/communities/[id]', params: { id } });

/** One of your communities: a cover band in its kind's colour with a big monogram behind. */
function Tile({ x }: { x: Community }) {
  const k = KIND_STYLE[x.kind];
  return (
    <Card onPress={() => open(x.id)} label={x.name} style={styles.tile}>
      <View style={[styles.band, { backgroundColor: k.band }]}>
        {isPrivate(x) ? (
          <View style={styles.private}>
            <Icon name="lock" size={12} color={colors.brand} strokeWidth={2.6} />
            <Text variant="eyebrow" color="brand">
              Private
            </Text>
          </View>
        ) : (
          <Text variant="decor" size="sm" style={[styles.monogram, { color: k.monogram }]}>
            {x.kind === 'team_impact' ? 'TI' : monogram(x.name, x.kind === 'team')}
          </Text>
        )}
        <View style={styles.badge}>
          <Icon name={KIND_ICON[x.kind]} size={18} color={k.icon} />
        </View>
      </View>
      <View style={styles.tileText}>
        <Text weight="semibold" numberOfLines={2}>
          {x.name}
        </Text>
        <Text variant="caption" weight="medium" color="muted">
          {subtitle(x)}
        </Text>
      </View>
    </Card>
  );
}

/**
 * "/me/communities": yours first, then ones to join; private ones take a request the creator
 * approves. Teens and recruiters never get medical communities from the API; parents can create
 * medical ones only (PRD §5). With the medical switch off, the kind is offered to no one (PRD §11).
 */
export default function Communities() {
  const { role } = useRole();
  const { state, reload } = useApi(() => api.communities());
  const flags = useApi(() => api.flags());
  // Until the flags load (or if they fail), medical counts as off.
  const kinds = creatableKinds(role, flags.state.status === 'ready' ? flags.state.data : undefined);
  const [query, setQuery] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = (id: string) => {
    setJoining(id);
    setError(null);
    api
      .joinCommunity(id)
      .then(reload, (e: Error) => setError(e.message))
      .finally(() => setJoining(null));
  };

  return (
    <Screen title="Communities" back>
      <Gutter>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a community"
            placeholderTextColor={colors.text.muted}
            accessibilityLabel="Search communities"
            style={styles.searchInput}
          />
        </View>
      </Gutter>
      <Async state={state}>
        {(all) => {
          // Name or description, so a private community is findable by what it's for (PRD v2.3).
          const q = query.trim().toLowerCase();
          const match = (x: Community) =>
            x.name.toLowerCase().includes(q) || x.about.toLowerCase().includes(q);
          const mine = all.filter((x) => x.myMembership && match(x));
          const others = all.filter((x) => !x.myMembership && match(x));
          return (
            <>
              <SectionLabel>{`Yours · ${mine.length}`}</SectionLabel>
              <Gutter>
                <View style={styles.grid}>
                  {mine.map((x) => (
                    <Tile key={x.id} x={x} />
                  ))}
                </View>
              </Gutter>
              {(others.length > 0 || kinds.length > 0) && <SectionLabel>Discover</SectionLabel>}
              <Gutter>
                {error && <ErrorText>{error}</ErrorText>}
                {others.map((x) => (
                  // A plain card: the Join button can't sit inside another button on web.
                  <Card key={x.id} style={styles.row}>
                    <Pressable
                      onPress={() => open(x.id)}
                      accessibilityRole="button"
                      accessibilityLabel={x.name}
                      style={styles.rowMain}
                    >
                      <View style={[styles.rowTile, { backgroundColor: KIND_STYLE[x.kind].band }]}>
                        <Text
                          variant="display"
                          size="xs"
                          color={KIND_STYLE[x.kind].onBand}
                          accessibilityRole="none"
                        >
                          {monogram(x.name, x.kind === 'team')}
                        </Text>
                      </View>
                      <View style={styles.rowText}>
                        <Text weight="semibold">{x.name}</Text>
                        <Text variant="caption" weight="medium" color="muted" numberOfLines={1}>
                          {subtitle(x)}
                        </Text>
                      </View>
                    </Pressable>
                    {role &&
                      canJoinCommunity(role, x.kind) &&
                      ((x.kind === 'interest' || x.kind === 'medical') && x.myJoinRequest ? (
                        <Button
                          label="Requested"
                          variant="secondary"
                          size="sm"
                          disabled
                          onPress={() => undefined}
                        />
                      ) : (
                        <Button
                          label={
                            joining === x.id ? 'Sending…' : isPrivate(x) ? 'Ask to join' : 'Join'
                          }
                          variant="brand"
                          size="sm"
                          disabled={joining === x.id}
                          onPress={() => join(x.id)}
                        />
                      ))}
                  </Card>
                ))}
                {kinds.length > 0 && (
                  <Card
                    onPress={() => router.push('/me/communities/new')}
                    label="Start a community"
                    style={styles.create}
                  >
                    <View style={[styles.rowTile, { backgroundColor: colors.actionTint }]}>
                      <Icon name="plus" size={22} color={colors.actionPressed} strokeWidth={2.4} />
                    </View>
                    <View style={styles.rowText}>
                      <Text weight="semibold">Start a community</Text>
                      <Text variant="caption" weight="medium" color="muted">
                        {kinds.length > 1 ? 'Interest or medical.' : `${KIND_LABEL[kinds[0]!]}.`}{' '}
                        Names are checked first.
                      </Text>
                    </View>
                  </Card>
                )}
              </Gutter>
            </>
          );
        }}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.buttonHeight.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.text.muted,
  },
  searchInput: {
    ...typeStyle(typography.body),
    flex: 1,
    color: colors.ink,
    minHeight: layout.minTouchTarget,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    padding: spacing.none,
    gap: spacing.none,
    overflow: 'hidden',
  },
  band: { height: BAND, justifyContent: 'flex-end', paddingHorizontal: spacing.sm },
  tileText: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  monogram: { position: 'absolute', right: 8, top: -6 },
  private: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    marginBottom: spacing.md * -1,
    width: BADGE,
    height: BADGE,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.xs },
  rowTile: {
    width: ROW_TILE,
    height: ROW_TILE,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
});
