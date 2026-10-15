import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { QrCodePreview } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { codeFromScan, NOT_A_CODE, qrProblem, type QrProblem } from '@/components/join';
import { QrScanner } from '@/components/QrScanner';
import { ErrorText, Gutter, Screen } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import { Button, Card, Icon, Input, TeamAvatar, Text } from '@/ui';

const teamLabel = (p: QrCodePreview) => `${p.team.college.name.split(' ')[0]} ${p.team.name}`;

/** A dead or bad code: what happened and what to do next, never a dead end. */
function ProblemCard({
  problem,
  signedIn,
  onOther,
  onRetry,
  onEnter,
}: {
  problem: QrProblem;
  signedIn: boolean;
  onOther: () => void;
  onRetry: () => void;
  onEnter: () => void;
}) {
  return (
    <Card style={styles.problem} accessibilityRole="alert">
      <View style={styles.problemHead}>
        <Icon name="flag" size={20} color={colors.danger} />
        <Text weight="semibold" style={styles.grow}>
          {problem.title}
        </Text>
      </View>
      <Text variant="small" color="secondary">
        {problem.body}
      </Text>
      {problem.next === 'retry' && <Button label="Try again" onPress={onRetry} />}
      {problem.next === 'enter' && <Button label="Enter the app" onPress={onEnter} />}
      {problem.next === 'other' && (
        <>
          <Button label="Try another code" onPress={onOther} />
          {signedIn && (
            <Button
              label="Find your team instead"
              variant="secondary"
              onPress={() => router.push('/onboarding/find-team')}
            />
          )}
        </>
      )}
    </Card>
  );
}

/**
 * "/scan": join a team from the coach's QR code, the fast lane: a live code puts you on the team
 * with no approval (qr-codes contract). The camera reads the QR; typing the code under it is the
 * fallback when the camera is blocked or missing. `?code=` arrives from a scanned link or after
 * signing up.
 */
export default function ScanQR() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { me, role, setMe } = useRole();
  const [typed, setTyped] = useState(params.code ?? '');
  /** The cleaned-up code that `preview` belongs to; joining and sign-up use this one. */
  const [code, setCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<QrCodePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<QrProblem | null>(null);
  /** How the code comes in. The camera is the default; typing is the fallback, and the only way
   *  in when the camera is blocked or missing. */
  const [mode, setMode] = useState<'camera' | 'typing'>('camera');

  const lookUp = (value = typed) => {
    if (!value.trim()) return;
    const found = codeFromScan(value);
    setPreview(null);
    if (!found) return setProblem(NOT_A_CODE);
    setBusy(true);
    setProblem(null);
    api.qrPreview(found).then(
      (p) => {
        setCode(found);
        setPreview(p);
        setBusy(false);
      },
      (e: unknown) => {
        setProblem(qrProblem(e));
        setBusy(false);
      },
    );
  };

  /**
   * A scan: a Team IMPACT code is looked up like a typed one; anything else says so. The code also
   * goes into `typed`, so "Try again" (which re-reads `typed`) works after a scan too.
   */
  const onScan = (found: string | null) => {
    if (!found) return setProblem(NOT_A_CODE);
    setTyped(found);
    lookUp(found);
  };

  // A code in the link (or carried through sign-up) is looked up straight away.
  useEffect(() => {
    if (params.code) lookUp(params.code);
  }, [params.code]);

  const join = () => {
    if (!code || !preview) return;
    setBusy(true);
    setProblem(null);
    api
      .joinWithQr(code)
      .then(() => api.me())
      .then(
        (updated) => {
          setMe(updated);
          // The earned moment: the Signed screen stamps it, then offers the next step.
          router.replace({ pathname: '/signed', params: { teamId: preview.team.id } });
        },
        (e: unknown) => {
          setProblem(qrProblem(e));
          setBusy(false);
        },
      );
  };

  const startOver = () => {
    setPreview(null);
    setCode(null);
    setProblem(null);
    setTyped('');
  };

  const canJoin = role === 'athlete' || role === 'parent' || role === 'teen';

  return (
    <Screen eyebrow="Fast lane" title="Scan a team QR code" back>
      <Gutter gap="md">
        {/* The camera hides while a lookup runs: it switches off, and comes back fresh after
            "Try another code". `paused` only matters if it ever stays on screen. */}
        {!preview && !problem && mode === 'camera' && !busy && (
          <QrScanner paused={busy} onScan={onScan} onTypeInstead={() => setMode('typing')} />
        )}

        {!preview && !problem && mode === 'camera' && busy && (
          <ActivityIndicator color={colors.brand} accessibilityLabel="Looking up the code" />
        )}

        {!preview && !problem && mode === 'typing' && (
          <>
            <Text color="secondary">
              Type the code printed under the coach’s QR. Codes last up to a week, and the coach can
              turn one off at any time.
            </Text>
            <Input
              label="Team code"
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              onSubmitEditing={() => lookUp()}
            />
            {busy ? (
              <ActivityIndicator color={colors.brand} accessibilityLabel="Looking up the code" />
            ) : (
              <Button
                label="Find team"
                size="lg"
                disabled={!typed.trim()}
                onPress={() => lookUp()}
              />
            )}
            <Button
              label="Scan with the camera instead"
              variant="secondary"
              icon="qr"
              onPress={() => setMode('camera')}
            />
          </>
        )}

        {preview && (
          <Card style={styles.team}>
            <TeamAvatar name={preview.team.name} teamColor={preview.team.color} size="lg" />
            <View style={styles.grow}>
              <Text variant="eyebrow" color="success">
                Code found
              </Text>
              <Text variant="display" size="xs" color="brand">
                {teamLabel(preview)}
              </Text>
              <Text variant="small" color="secondary">
                {preview.team.sport} · Division {preview.team.division}
              </Text>
              <Text variant="caption" weight="medium" color="muted">
                Shared by Coach {preview.sharedBy.lastName} · expires {shortDate(preview.expiresAt)}
              </Text>
            </View>
          </Card>
        )}

        {problem && (
          <ProblemCard
            problem={problem}
            signedIn={!!me}
            onOther={startOver}
            onRetry={() => (preview ? join() : lookUp())}
            onEnter={() => role && router.replace(firstTab(role))}
          />
        )}

        {preview && !problem && me && canJoin && (
          <>
            <Text color="secondary">A coach’s code skips the wait. You join straight away.</Text>
            <Button
              label={busy ? 'Joining…' : `Join ${teamLabel(preview)}`}
              size="lg"
              disabled={busy}
              onPress={join}
            />
          </>
        )}

        {preview && me && !canJoin && (
          <ErrorText>Team codes are for athletes, parents and teammates.</ErrorText>
        )}

        {preview && !me && code && (
          <>
            <Text color="secondary">
              Create your account first. You’ll come straight back here and join.
            </Text>
            <Button
              label="Create an account to join"
              size="lg"
              onPress={() => router.push({ pathname: '/sign-up', params: { qr: code } })}
            />
            {__DEV__ && (
              <Button
                label="Mock sign-in"
                variant="secondary"
                onPress={() => router.push('/dev-sign-in')}
              />
            )}
          </>
        )}

        {preview && !problem && (
          <Button label="Use a different code" variant="secondary" onPress={startOver} />
        )}
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  team: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  problem: { gap: spacing.sm },
  problemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
