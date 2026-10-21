import { createURL } from 'expo-linking';
import { useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { QrCodeLifetime, TeamQrCode } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { dateTime, shortDate } from '@/components/format';
import { savePng } from '@/components/savePng';
import { formatShortCode, fullName, NoTeam, PersonRow, useTeamId } from '@/components/team';
import { Async, ErrorText, Gutter, Screen, SectionLabel, Segmented } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Input, Text } from '@/ui';

const QR_SIZE = 208;

const LIFETIMES: { value: QrCodeLifetime; label: string }[] = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'day', label: '24 hours' },
  { value: 'week', label: 'A week' },
];

/** What the code encodes and what "Share link" sends: the app opens it on the scan screen. */
const joinLink = (shortCode: string) => createURL('/scan', { queryParams: { code: shortCode } });

const isLive = (c: TeamQrCode, now = Date.now()) =>
  c.revokedAt === null && Date.parse(c.expiresAt) > now;

/** react-native-svg's `toDataURL` gives a base64 PNG on native and web alike. */
type SvgRef = { toDataURL: (callback: (base64: string) => void) => void };

/** Who joined through one code. The coach can remove anyone from the roster. */
function Joins({ codeId }: { codeId: string }) {
  const { state } = useApi(() => api.qrCodeJoins(codeId), [codeId]);
  return (
    <Async state={state}>
      {(joins) =>
        joins.length ? (
          <View style={styles.joins}>
            {joins.map((j) => (
              <PersonRow key={j.user.id} user={j.user} detail={`Joined ${shortDate(j.joinedAt)}`} />
            ))}
          </View>
        ) : (
          <Text variant="small" color="secondary">
            Nobody has joined with this code yet.
          </Text>
        )
      }
    </Async>
  );
}

function LiveCode({ code, onRevoke }: { code: TeamQrCode; onRevoke: () => void }) {
  const svg = useRef<SvgRef | null>(null);
  const [showJoins, setShowJoins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = joinLink(code.shortCode);
  const fileName = `team-code-${code.shortCode}.png`;

  const exportPng = () =>
    svg.current?.toDataURL((base64) => {
      savePng(base64, fileName).catch((e: Error) => setError(e.message));
    });
  const revoke = () => api.revokeQrCode(code.id).then(onRevoke, (e: Error) => setError(e.message));

  return (
    <Card>
      <View style={styles.between}>
        <Text weight="semibold">{code.label ?? 'Team code'}</Text>
        <Text variant="caption" weight="medium" color="muted">
          {code.joinCount} joined
        </Text>
      </View>
      <View
        style={styles.qr}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`QR code to join the team. Code ${formatShortCode(code.shortCode)}`}
      >
        <QRCode
          value={link}
          size={QR_SIZE}
          color={colors.ink}
          backgroundColor={colors.surface}
          quietZone={spacing.md}
          ecl="M"
          getRef={(ref: SvgRef | null) => {
            svg.current = ref;
          }}
        />
      </View>
      <View style={styles.center}>
        <Text variant="eyebrow" color="secondary">
          Or type the code
        </Text>
        <Text variant="display" size="lg" color="brand" selectable>
          {formatShortCode(code.shortCode)}
        </Text>
        <Text variant="caption" color="muted" selectable numberOfLines={1}>
          {link}
        </Text>
        <Text variant="small" color="secondary">
          Joins straight away, no approval. Expires {dateTime(code.expiresAt)}.
        </Text>
      </View>
      <View style={styles.buttons}>
        <Button
          label="Share link"
          size="sm"
          stretch
          onPress={() =>
            Share.share({ message: `Join our team on Team IMPACT: ${link}` }).catch(() => undefined)
          }
        />
        <Button label="Export PNG" variant="secondary" size="sm" stretch onPress={exportPng} />
      </View>
      <View style={styles.buttons}>
        <Button
          label={showJoins ? 'Hide who joined' : 'Who joined'}
          variant="secondary"
          size="sm"
          stretch
          onPress={() => setShowJoins((v) => !v)}
        />
        <Button label="Turn off" variant="ink" size="sm" stretch onPress={revoke} />
      </View>
      {showJoins && <Joins codeId={code.id} />}
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}

function PastCode({ code }: { code: TeamQrCode }) {
  const [showJoins, setShowJoins] = useState(false);
  const ended = code.revokedAt
    ? `Turned off ${shortDate(code.revokedAt)}`
    : `Expired ${shortDate(code.expiresAt)}`;
  return (
    <Card>
      <View style={styles.between}>
        <View style={styles.grow}>
          <Text weight="semibold">{code.label ?? formatShortCode(code.shortCode)}</Text>
          <Text variant="caption" weight="medium" color="muted">
            {ended} · {code.joinCount} joined · by {fullName(code.createdBy)}
          </Text>
        </View>
        <Button
          label={showJoins ? 'Hide' : 'Who joined'}
          variant="secondary"
          size="sm"
          onPress={() => setShowJoins((v) => !v)}
        />
      </View>
      {showJoins && <Joins codeId={code.id} />}
    </Card>
  );
}

function NewCode({ teamId, onCreated }: { teamId: string; onCreated: () => void }) {
  const [label, setLabel] = useState('');
  const [lifetime, setLifetime] = useState<QrCodeLifetime>('week');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = () => {
    setBusy(true);
    api.createQrCode(teamId, { lifetime, label: label.trim() || undefined }).then(
      () => {
        setBusy(false);
        setLabel('');
        setError(null);
        onCreated();
      },
      (e: Error) => {
        setBusy(false);
        setError(e.message);
      },
    );
  };
  return (
    <Card>
      <Text weight="semibold">Make a new code</Text>
      <Input
        label="Label (optional)"
        placeholder="Parents’ night"
        value={label}
        onChangeText={setLabel}
        maxLength={60}
      />
      <Text variant="small" weight="semibold">
        Works for
      </Text>
      <Segmented
        label="How long the code works"
        value={lifetime}
        onChange={setLifetime}
        options={LIFETIMES}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Make code" icon="qr" disabled={busy} onPress={create} />
    </Card>
  );
}

/**
 * "/team/qr": the fast lane. Anyone who scans a live code (or types its short code) joins the
 * team straight away, so codes are short-lived and the coach can turn one off at any time.
 */
export default function CoachQR() {
  const teamId = useTeamId();
  const codes = useApi(() => (teamId ? api.qrCodes(teamId) : Promise.resolve(null)), [teamId]);
  return (
    <Screen eyebrow="Team" title="QR codes" back>
      <Async state={codes.state}>
        {(list) => {
          if (!list || !teamId) {
            return (
              <Gutter>
                <NoTeam />
              </Gutter>
            );
          }
          const live = list.filter((c) => isLive(c));
          const past = list.filter((c) => !isLive(c));
          return (
            <>
              <Gutter>
                {live.length === 0 && (
                  <Text color="secondary">No live codes. Make one for your next meeting.</Text>
                )}
                {live.map((c) => (
                  <LiveCode key={c.id} code={c} onRevoke={codes.reload} />
                ))}
                <NewCode teamId={teamId} onCreated={codes.reload} />
              </Gutter>
              {past.length > 0 && (
                <>
                  <SectionLabel>Earlier codes</SectionLabel>
                  <Gutter gap="sm">
                    {past.map((c) => (
                      <PastCode key={c.id} code={c} />
                    ))}
                  </Gutter>
                </>
              )}
            </>
          );
        }}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grow: { flex: 1, gap: spacing.xs },
  qr: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  center: { alignItems: 'center', gap: spacing.xs },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  joins: { gap: spacing.sm },
});
