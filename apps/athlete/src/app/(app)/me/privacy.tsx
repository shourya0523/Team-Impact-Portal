import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { MySettings } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { SwitchRow } from '@/components/SwitchRow';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Card, Icon, Text } from '@/ui';

/** A rule of what the app never shows, with a lock. */
function Assurance({ children }: { children: string }) {
  return (
    <Card style={styles.note}>
      <Icon name="lock" size={18} color={colors.brand} />
      <Text variant="small" color="brand" style={styles.grow}>
        {children}
      </Text>
    </Card>
  );
}

/**
 * "/me/privacy": who can see you, and being searchable through official communities (TI-116).
 * The searchable switch is the same setting as the one on the community's page.
 */
export default function Privacy() {
  const { role } = useRole();
  const { state } = useApi(() => api.settings());
  const [override, setOverride] = useState<MySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cardHolder = role === 'athlete' || role === 'alumni_athlete';

  const setSearchable = (communityId: string, on: boolean) =>
    api.updateSettings({ searchable: [{ communityId, on }] }).then(
      (s) => {
        setError(null);
        setOverride(s);
      },
      (e: Error) => setError(e.message),
    );

  return (
    <Screen eyebrow="Me" title="Privacy" back>
      <Async state={state}>
        {(loaded) => {
          const s = override ?? loaded;
          return (
            <Gutter>
              {role === 'teen' && (
                <Assurance>
                  Your profile is visible only to your team. You never appear in search or to
                  recruiters.
                </Assurance>
              )}
              {role === 'parent' && (
                <Assurance>
                  Your child’s profile is visible only to your team and family. It never appears in
                  search, recruiter views or card exports.
                </Assurance>
              )}
              <Assurance>
                Medical communities you join are private to you: never on your profile, never
                searchable, never a recruiter filter.
              </Assurance>

              {cardHolder && (
                <>
                  <SectionLabel>Searchable by recruiters</SectionLabel>
                  <Text variant="small" color="secondary">
                    Recruiters can filter by official communities, but only find members who turn
                    this on. Separate from joining; every search like this is logged. Needs a
                    published card.
                  </Text>
                  {s.searchable.length === 0 ? (
                    <Card>
                      <Text variant="small" color="secondary">
                        You’re not in any official community yet.
                      </Text>
                      <Button
                        label="Browse communities"
                        variant="secondary"
                        size="sm"
                        onPress={() => router.push('/me/communities')}
                      />
                    </Card>
                  ) : (
                    <Card>
                      {s.searchable.map((x) => (
                        <SwitchRow
                          key={x.community.id}
                          label={x.community.name}
                          detail={x.on ? 'Recruiters can find you through it' : 'Not searchable'}
                          value={x.on}
                          onChange={(on) => setSearchable(x.community.id, on)}
                        />
                      ))}
                    </Card>
                  )}

                  <SectionLabel>Recruiting</SectionLabel>
                  <Card>
                    <Text weight="semibold">
                      {s.openToRecruiting.on ? 'Open to recruiting' : 'Not open to recruiting'}
                    </Text>
                    <Text variant="small" color="secondary">
                      {s.openToRecruiting.on
                        ? 'Partner recruiters can find your published card.'
                        : 'You don’t appear on the employer portal at all.'}
                    </Text>
                    <Button
                      label="Contacts and recruiting"
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push('/me/recruiting')}
                    />
                  </Card>
                </>
              )}
              {error && <ErrorText>{error}</ErrorText>}
            </Gutter>
          );
        }}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.brandTint,
    borderColor: colors.brandTint,
  },
  grow: { flex: 1 },
});
