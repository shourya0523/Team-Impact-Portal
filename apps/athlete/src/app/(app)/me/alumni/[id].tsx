import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import type { AlumniProfile } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ALUMNI_BROWSERS, HelpBadges, helpText } from '@/components/alumni';
import { Async, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Card, Icon, Text, type IconName } from '@/ui';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" color="secondary">
        {label}
      </Text>
      <Text weight="semibold" style={styles.factValue}>
        {value}
      </Text>
    </View>
  );
}

function Channel({
  icon,
  label,
  value,
  url,
}: {
  icon: IconName;
  label: string;
  value: string;
  url: string;
}) {
  return (
    <Card onPress={() => void Linking.openURL(url)} label={`${label}: ${value}`} style={styles.row}>
      <Icon name={icon} size={20} color={colors.brand} />
      <View style={styles.grow}>
        <Text variant="caption" color="muted">
          {label}
        </Text>
        <Text color="brand" weight="medium" selectable>
          {value}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={colors.text.muted} />
    </Card>
  );
}

const linkedInUrl = (v: string) => (/^https?:\/\//.test(v) ? v : `https://${v}`);

function Alumnus({ a }: { a: AlumniProfile }) {
  const name = `${a.user.firstName} ${a.user.lastName}`;
  const { email, phone, linkedinUrl } = a.contact;
  const helping = a.mentoring || a.hiring;
  return (
    <Gutter>
      <View style={styles.hero}>
        <Avatar name={name} role={a.user.role} size="lg" />
        <View style={styles.grow}>
          <Text variant="display" size="sm" color="onBrand">
            {name}
          </Text>
          {a.employer && (
            <Text variant="small" color="onBrandSecondary">
              {a.employer}
            </Text>
          )}
          <View style={styles.badges}>
            <HelpBadges alumnus={a} onBrand />
          </View>
        </View>
      </View>

      <Card>
        <Fact label="College attended" value={a.college || 'Not added yet'} />
        <Fact label="Works at" value={a.employer ?? 'Not added'} />
      </Card>

      {(email || phone || linkedinUrl) && (
        <>
          <SectionLabel>{`Reach ${a.user.firstName}`}</SectionLabel>
          {email && <Channel icon="mail" label="Email" value={email} url={`mailto:${email}`} />}
          {phone && (
            <Channel
              icon="comment"
              label="Phone"
              value={phone}
              url={`tel:${phone.replace(/[^\d+]/g, '')}`}
            />
          )}
          {linkedinUrl && (
            <Channel
              icon="briefcase"
              label="LinkedIn"
              value={linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
              url={linkedInUrl(linkedinUrl)}
            />
          )}
        </>
      )}

      <Text variant="small" color="secondary">
        {helping
          ? `Shown because ${a.user.firstName} turned on ${helpText(a)}. There’s no messaging in the app: reach out through these details. Alumni never see athlete lists.`
          : `${a.user.firstName} isn’t mentoring or hiring, so athletes don’t see this profile.`}
      </Text>
    </Gutter>
  );
}

/** "/me/alumni/[id]": one alumnus who's mentoring or hiring, with the contacts they share (L4). */
export default function AlumniProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useRole();
  const allowed = !!role && ALUMNI_BROWSERS.includes(role);
  const { state } = useApi(
    () => (allowed ? api.alumnus(id) : Promise.reject(new Error('Not available for your role'))),
    [id, allowed],
  );
  return (
    <Screen eyebrow="Alumni who help" title="Alumni profile" back>
      <Async state={state}>{(a) => <Alumnus a={a} />}</Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Navy hero, as in the design; text on it uses the onBrand pairs.
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.brand,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  factValue: { flexShrink: 1, textAlign: 'right' },
});
