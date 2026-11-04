import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CURRENT_TERMS_VERSION,
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_NAMES,
  LEGAL_DOCUMENTS,
} from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { CheckRow, errorMessage } from '@/components/signup';
import { ErrorText, Gutter, Screen } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import { Button, Card, Text } from '@/ui';

/**
 * "/terms-update": the Terms, Privacy Policy or Acceptable Use Policy changed since this account
 * last agreed, so the signed-in tabs send them here first (TI-107). Accepting records the new
 * version, like sign-up; a teen confirms again that a parent or guardian agreed. Signing out is
 * the only other way on.
 */
export default function TermsUpdate() {
  const { role, ready, setMe, setRole } = useRole();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [parentAgreed, setParentAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!ready) return null;
  if (!role) return <Redirect href="/welcome" />;
  const isTeen = role === 'teen';

  const accept = async () => {
    setSending(true);
    setError(null);
    try {
      await api.acceptTerms({
        acceptTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
        ...(isTeen ? { parentAgreed: true as const } : {}),
      });
      router.replace(firstTab(role));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const signOut = () => {
    void api.signOut().catch(() => undefined);
    setMe(null);
    setRole(null);
    router.replace('/welcome');
  };

  return (
    <Screen eyebrow="Before you carry on" title="Our terms have changed">
      <Gutter gap="md">
        <Text color="secondary">
          We’ve updated the Team IMPACT {LEGAL_DOCUMENT_NAMES}. Please read them and agree to keep
          using the app.
        </Text>
        <Card>
          <Text variant="eyebrow" color="secondary">
            What changed
          </Text>
          <View accessibilityRole="list" style={styles.list}>
            {LEGAL_DOCUMENT_IDS.map((doc) => (
              <Text key={doc} variant="small" accessibilityRole="text">
                {LEGAL_DOCUMENTS[doc].title}
              </Text>
            ))}
          </View>
          <Text variant="small" color="secondary">
            Version {CURRENT_TERMS_VERSION}. They say what you can post, who sees your details, and
            how to report, block or delete your account.
          </Text>
        </Card>
        {isTeen && (
          <CheckRow
            label="A parent or guardian agreed to the new terms with me"
            checked={parentAgreed}
            onToggle={() => setParentAgreed((v) => !v)}
          />
        )}
        <CheckRow
          label={`I agree to the ${LEGAL_DOCUMENT_NAMES}`}
          checked={acceptTerms}
          onToggle={() => setAcceptTerms((v) => !v)}
        />
        <Button
          label={sending ? 'Saving…' : 'Agree and continue'}
          size="lg"
          disabled={!acceptTerms || sending || (isTeen && !parentAgreed)}
          onPress={accept}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
