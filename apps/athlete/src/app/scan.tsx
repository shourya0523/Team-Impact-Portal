import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { QrCodePreview } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { errorMessage } from '@/components/signup';
import { ErrorText, Gutter, Screen } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import { Button, Card, Input, TeamAvatar, Text } from '@/ui';

const teamLabel = (p: QrCodePreview) => `${p.team.college.name.split(' ')[0]} ${p.team.name}`;

/**
 * "/scan": join a team from the coach's QR code, the fast lane: a live code puts you on the team
 * with no approval (qr-codes contract). The camera comes later; the code's text works everywhere,
 * including the web. `?code=` arrives from a scanned link or after signing up.
 */
export default function ScanQR() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { me, role, setMe } = useRole();
  const [code, setCode] = useState(params.code ?? '');
  const [preview, setPreview] = useState<QrCodePreview | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookUp = (value = code) => {
    const token = value.trim();
    if (!token) return;
    setBusy(true);
    setError(null);
    api.qrPreview(token).then(
      (p) => {
        setPreview(p);
        setBusy(false);
      },
      (e: unknown) => {
        setPreview(null);
        setError(errorMessage(e));
        setBusy(false);
      },
    );
  };

  // A code in the link (or carried through sign-up) is looked up straight away.
  useEffect(() => {
    if (params.code) lookUp(params.code);
  }, [params.code]);

  const join = () => {
    setBusy(true);
    setError(null);
    api
      .joinWithQr(code.trim())
      .then(() => api.me())
      .then(
        (updated) => {
          setMe(updated);
          setJoined(true);
          setBusy(false);
        },
        (e: unknown) => {
          setError(errorMessage(e));
          setBusy(false);
        },
      );
  };

  const canJoin = role === 'athlete' || role === 'parent' || role === 'teen';

  return (
    <Screen eyebrow="Fast lane" title={joined ? 'You’re on the team' : 'Scan a team QR code'} back>
      <Gutter gap="md">
        {!preview && (
          <>
            <Text color="secondary">
              Type the code printed under the coach’s QR. Codes last up to a week, and the coach can
              turn one off at any time.
            </Text>
            <Input
              label="Team code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => lookUp()}
            />
            <Button
              label={busy ? 'Looking…' : 'Find team'}
              size="lg"
              disabled={!code.trim() || busy}
              onPress={() => lookUp()}
            />
          </>
        )}

        {preview && (
          <Card style={styles.team}>
            <TeamAvatar name={preview.team.name} teamColor={preview.team.color} size="lg" />
            <View style={styles.grow}>
              <Text variant="eyebrow" color="secondary">
                {joined ? 'Joined' : 'Join'}
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

        {preview && !joined && me && canJoin && (
          <>
            <Text color="secondary">
              Scanning a live code puts you on the team now, with no wait for the coach.
            </Text>
            <Button
              label={busy ? 'Joining…' : `Join ${teamLabel(preview)}`}
              size="lg"
              disabled={busy}
              onPress={join}
            />
          </>
        )}

        {preview && !joined && me && !canJoin && (
          <ErrorText>Team codes are for athletes, parents and teammates.</ErrorText>
        )}

        {preview && !joined && !me && (
          <>
            <Text color="secondary">
              Create your account first. You’ll come straight back here.
            </Text>
            <Button
              label="Create an account to join"
              size="lg"
              onPress={() => router.push({ pathname: '/sign-up', params: { qr: code.trim() } })}
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

        {joined && role && preview && (
          <>
            <Button
              label="Enter the app"
              size="lg"
              onPress={() => router.replace(firstTab(role))}
            />
            {role === 'parent' && (
              <Button
                label="Add your child (coach approves)"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/onboarding/request',
                    params: {
                      teamId: preview.team.id,
                      teamName: teamLabel(preview),
                      division: preview.team.division,
                    },
                  })
                }
              />
            )}
          </>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        {preview && !joined && (
          <Button
            label="Use a different code"
            variant="secondary"
            onPress={() => {
              setPreview(null);
              setError(null);
            }}
          />
        )}
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  team: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
});
