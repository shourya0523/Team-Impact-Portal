import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AlumniProfile, FindAlumniQuery } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ALUMNI_BROWSERS, HelpBadges } from '@/components/alumni';
import { Async, Gutter, Screen, Segmented } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Card, FadeSlideIn, Icon, Input, Text } from '@/ui';

type Flag = 'all' | NonNullable<FindAlumniQuery['flag']>;

const FLAGS: { value: Flag; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mentoring', label: 'Mentoring' },
  { value: 'hiring', label: 'Hiring' },
];

function Row({ alumnus }: { alumnus: AlumniProfile }) {
  const name = `${alumnus.user.firstName} ${alumnus.user.lastName}`;
  return (
    <FadeSlideIn>
      <Card
        onPress={() =>
          router.push({ pathname: '/me/alumni/[id]', params: { id: alumnus.user.id } })
        }
        label={`${name}, ${[alumnus.employer, alumnus.college].filter(Boolean).join(', ')}`}
        style={styles.row}
      >
        <Avatar name={name} role={alumnus.user.role} />
        <View style={styles.grow}>
          <Text weight="semibold">{name}</Text>
          {alumnus.employer && (
            <Text variant="small" color="secondary">
              {alumnus.employer}
            </Text>
          )}
          <Text variant="caption" weight="medium" color="muted">
            {alumnus.college}
          </Text>
        </View>
        <View style={styles.badges}>
          <HelpBadges alumnus={alumnus} />
        </View>
        <Icon name="chevron" size={18} color={colors.text.muted} />
      </Card>
    </FadeSlideIn>
  );
}

function Browse() {
  const [flag, setFlag] = useState<Flag>('all');
  const [college, setCollege] = useState('');
  const [employer, setEmployer] = useState('');
  const q: FindAlumniQuery = {
    ...(flag !== 'all' ? { flag } : {}),
    ...(college.trim() ? { college: college.trim() } : {}),
    ...(employer.trim() ? { employer: employer.trim() } : {}),
  };
  const { state } = useApi(() => api.findAlumni(q), [flag, college.trim(), employer.trim()]);

  return (
    <Gutter>
      <Text color="secondary">
        Former athletes and Team IMPACT alumni who offered to mentor or are hiring. Reach them
        through the details they share.
      </Text>
      <Segmented label="Show" options={FLAGS} value={flag} onChange={setFlag} />
      <View style={styles.filters}>
        <View style={styles.grow}>
          <Input label="College" value={college} onChangeText={setCollege} placeholder="Tufts" />
        </View>
        <View style={styles.grow}>
          <Input label="Employer" value={employer} onChangeText={setEmployer} placeholder="Any" />
        </View>
      </View>
      <Async state={state}>
        {(people) =>
          people.length === 0 ? (
            <Card>
              <Text weight="semibold">No one yet</Text>
              <Text variant="small" color="secondary">
                Try a different filter, or clear the college and employer.
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {people.map((a) => (
                <Row key={a.user.id} alumnus={a} />
              ))}
            </View>
          )
        }
      </Async>
    </Gutter>
  );
}

/**
 * "/me/alumni": athletes (and alumni) browse alumni who turned on mentoring or hiring, by flag,
 * college and employer (PRD §8, A7). Teens, parents, coaches and recruiters don't get it.
 */
export default function AlumniBrowse() {
  const { role } = useRole();
  return (
    <Screen eyebrow="Me" title="Alumni who help" back>
      {role && ALUMNI_BROWSERS.includes(role) ? (
        <Browse />
      ) : (
        <Gutter>
          <Card>
            <Text weight="semibold">Not available for your account</Text>
            <Text variant="small" color="secondary">
              Alumni mentors and hiring alumni are for athletes and alumni.
            </Text>
          </Card>
        </Gutter>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  badges: { alignItems: 'flex-end', gap: spacing.xs },
  filters: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.sm },
});
