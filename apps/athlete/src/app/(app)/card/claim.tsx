import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { CardClaimPreview } from '@team-impact/contracts';
import { AthleteCard } from '@team-impact/ui-primitives/native';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';
import { toCardData } from '@/components/cardData';
import { shortDate } from '@/components/format';
import { errorMessage } from '@/components/signup';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Card, FadeSlideIn, Icon, Input, Text } from '@/ui';

/** Widest the card gets on tablets and web. */
const MAX_CARD_WIDTH = 320;

/** Paste the code from the invite email when the link didn't open the app. */
function EnterCode({ problem }: { problem?: string }) {
  const [code, setCode] = useState('');
  return (
    <Gutter>
      {problem ? (
        <ErrorText>{problem}</ErrorText>
      ) : (
        <Text color="secondary">
          Team IMPACT builds Baseball Cards for alumni from their public LinkedIn profile and emails
          each person a private link. Open the link from that email, or paste the code from it here.
          Nobody sees the card until you claim it and publish it.
        </Text>
      )}
      <Input
        label="Invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="claim-…"
      />
      <Button
        label="Find my card"
        size="lg"
        disabled={code.trim().length < 16}
        onPress={() => router.setParams({ token: code.trim() })}
      />
    </Gutter>
  );
}

/** Why a link didn't work, in words the alumnus can act on. */
const linkProblem = (e: Error) =>
  e instanceof ApiRequestError && e.status === 404
    ? 'We couldn’t find a card for that code. Check it against your invite email.'
    : e instanceof ApiRequestError && e.status === 410
      ? `${e.message}.`
      : `Couldn’t open this invite: ${e.message}`;

function Claim({ token, preview }: { token: string; preview: CardClaimPreview }) {
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { face } = preview;
  // The preview has no ids or last name; the card primitive only needs something to seed its art.
  const data = toCardData({ ...face, id: token, athleteId: token, lastName: '' });

  const claim = () => {
    setBusy(true);
    setError(null);
    api.claimCard(token).then(
      () => router.replace('/card/review'),
      (e: unknown) => {
        setError(errorMessage(e));
        setBusy(false);
      },
    );
  };

  return (
    <Gutter>
      <Text variant="eyebrow" color="action">
        {`Personal invite for ${face.firstName}`}
      </Text>
      <Text color="secondary">
        Team IMPACT built this from your public LinkedIn profile. Nobody can see it until you claim
        it, check it and publish it.
      </Text>
      <FadeSlideIn>
        <View style={styles.center}>
          <AthleteCard athlete={data} width={Math.min(width - spacing.md * 2, MAX_CARD_WIDTH)} />
        </View>
      </FadeSlideIn>
      <Text variant="small" color="secondary" style={styles.centerText}>
        Tap or swipe the card to see the back.
      </Text>
      <Card style={styles.note}>
        <Icon name="lock" size={18} color={colors.brand} />
        <Text variant="small" color="brand" style={styles.grow}>
          Anything wrong? You’ll check every field before it goes on your card, and it stays private
          until you publish.
        </Text>
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
      <Button
        label={busy ? 'Claiming…' : 'Claim and review my card'}
        size="lg"
        disabled={busy}
        onPress={claim}
      />
      <Button label="Not now" variant="secondary" disabled={busy} onPress={() => router.back()} />
      <Text variant="caption" weight="medium" color="muted">
        {`This link works once, until ${shortDate(preview.expiresAt)}.`}
      </Text>
    </Gutter>
  );
}

function Preview({ token }: { token: string }) {
  const { state } = useApi(() => api.cardClaim(token), [token]);
  if (state.status === 'error') return <EnterCode problem={linkProblem(state.error)} />;
  return <Async state={state}>{(preview) => <Claim token={token} preview={preview} />}</Async>;
}

/**
 * "/card/claim?token=…": an alumni athlete claims the Baseball Card Team IMPACT pre-built for
 * them, from the personal link in their invite email (L5). Only alumni athletes can open it; the
 * claim is single use and lands in the card review, so nothing is shown until they confirm.
 */
export default function ClaimCard() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { role } = useRole();
  return (
    <Screen eyebrow="Baseball Card" title="We saved your card" back>
      {role !== 'alumni_athlete' ? (
        <Gutter>
          <Card>
            <Text weight="semibold">For alumni athletes</Text>
            <Text variant="small" color="secondary">
              Pre-built cards are claimed by the alumni athlete they were made for, signed in to
              their own alumni account.
            </Text>
          </Card>
        </Gutter>
      ) : token ? (
        <Preview token={token} />
      ) : (
        <EnterCode />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.brandTint,
    borderColor: colors.brandTint,
  },
  grow: { flex: 1 },
});
