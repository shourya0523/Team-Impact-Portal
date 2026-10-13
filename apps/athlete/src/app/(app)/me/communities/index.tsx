import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { canCreateCommunity, canJoinCommunity, type Community } from '@team-impact/contracts';
import { api } from '@/api';
import { Icon, type IconName } from '@/components/Icon';
import { Async, Button, Card, Gutter, Screen, SectionLabel, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { c, font, KIND_STYLE, monogram } from '@/theme';

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
            <Icon name="lock" size={12} color={c.navy} strokeWidth={2.6} />
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: c.navy }}>PRIVATE</Text>
          </View>
        ) : (
          <Text style={[styles.monogram, { color: k.monogram }]}>
            {x.kind === 'team_impact' ? 'TI' : monogram(x.name, x.kind === 'team')}
          </Text>
        )}
        <View style={styles.badge}>
          <Icon name={KIND_ICON[x.kind]} size={18} color={k.icon} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 22, paddingBottom: 12, gap: 2 }}>
        <Text style={type.name} numberOfLines={2}>
          {x.name}
        </Text>
        <Text style={type.meta}>{subtitle(x)}</Text>
      </View>
    </Card>
  );
}

/**
 * "/me/communities": yours first, then ones to join; private ones take a request the creator
 * approves. Teens and recruiters never get medical
 * communities from the API; parents can create medical ones only (PRD §5).
 */
export default function Communities() {
  const { role } = useRole();
  const { state, reload } = useApi(() => api.communities());
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
          <Icon name="search" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a community"
            placeholderTextColor={c.muted}
            accessibilityLabel="Search communities"
            style={styles.searchInput}
          />
        </View>
      </Gutter>
      <Async state={state}>
        {(all) => {
          const match = (x: Community) => x.name.toLowerCase().includes(query.trim().toLowerCase());
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
              {(others.length > 0 || (role && canCreateCommunity(role, 'medical'))) && (
                <SectionLabel>Discover</SectionLabel>
              )}
              <Gutter>
                {error && (
                  <Text
                    style={{ color: c.danger, fontFamily: font.medium }}
                    accessibilityRole="alert"
                  >
                    {error}
                  </Text>
                )}
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
                          style={{
                            fontFamily: font.display,
                            fontSize: 20,
                            color: x.kind === 'interest' ? c.ink : '#fff',
                          }}
                        >
                          {monogram(x.name, x.kind === 'team')}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={type.name}>{x.name}</Text>
                        <Text style={type.meta} numberOfLines={1}>
                          {subtitle(x)}
                        </Text>
                      </View>
                    </Pressable>
                    {role &&
                      canJoinCommunity(role, x.kind) &&
                      ((x.kind === 'interest' || x.kind === 'medical') && x.myJoinRequest ? (
                        <Button
                          label="Requested"
                          kind="outline"
                          size="sm"
                          disabled
                          onPress={() => undefined}
                        />
                      ) : (
                        <Button
                          label={
                            joining === x.id ? 'Sending…' : isPrivate(x) ? 'Ask to join' : 'Join'
                          }
                          kind="navy"
                          size="sm"
                          disabled={joining === x.id}
                          onPress={() => join(x.id)}
                        />
                      ))}
                  </Card>
                ))}
                {role && canCreateCommunity(role, 'medical') && (
                  <Card
                    onPress={() => router.push('/me/communities/new')}
                    label="Start a community"
                    style={styles.create}
                  >
                    <View style={[styles.rowTile, { backgroundColor: c.redTint }]}>
                      <Icon name="plus" size={22} color={c.redPressed} strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={type.name}>Start a community</Text>
                      <Text style={type.meta}>
                        {canCreateCommunity(role, 'interest') ? 'Interest or medical.' : 'Medical.'}{' '}
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
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 15, color: c.ink, minHeight: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, padding: 0, gap: 0, overflow: 'hidden' },
  band: { height: 64, justifyContent: 'flex-end', paddingHorizontal: 12 },
  monogram: {
    position: 'absolute',
    right: 8,
    top: -6,
    fontFamily: font.display,
    fontSize: 56,
    lineHeight: 64,
  },
  private: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    marginBottom: -16,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#b9b2a3',
    backgroundColor: 'transparent',
  },
});
