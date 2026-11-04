import { useState, type FormEvent } from 'react';
import {
  CURRENT_TERMS_VERSION,
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_NAMES,
  LEGAL_DOCUMENTS,
} from '@team-impact/contracts';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { ApiRequestError } from '../api';
import { useSession } from '../session';
import { Button, Card, Logo, Text } from '../ui';

const messageOf = (e: unknown) => {
  if (e instanceof ApiRequestError) {
    const issues = e.body.error.issues?.map((i) => i.message) ?? [];
    return issues.length ? issues.join(' ') : e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
};

/**
 * Shown in place of every signed-in page when the Terms, Privacy Policy or Acceptable Use Policy
 * changed since this account last agreed (TI-107). Accepting records the new version, like
 * sign-up; signing out is the only other way on.
 */
export const TermsUpdatePage = () => {
  const { acceptTerms, signOut } = useSession();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setBusy(true);
    setError(null);
    acceptTerms()
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: colors.ground,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <div style={{ width: '100%', maxWidth: layout.maxContentWidth }}>
        <Card>
          <form
            onSubmit={submit}
            style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
          >
            <Logo size="sm" />
            <Text variant="eyebrow" color="secondary">
              Before you carry on
            </Text>
            <Text as="h1" variant="display" size="md" color="brand" style={{ margin: 0 }}>
              Our terms have changed
            </Text>
            <section aria-label="Legal terms">
              <Text color="secondary">
                We’ve updated the{' '}
                {LEGAL_DOCUMENT_IDS.map((doc, i) => (
                  <span key={doc}>
                    {i > 0 && (i === LEGAL_DOCUMENT_IDS.length - 1 ? ' and ' : ', ')}
                    <strong>{LEGAL_DOCUMENTS[doc].title}</strong>
                  </span>
                ))}{' '}
                (version {CURRENT_TERMS_VERSION}). Please read them and agree to keep using the
                portal.
              </Text>
            </section>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: layout.minTouchTarget,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ accentColor: colors.brand, width: spacing.lg, height: spacing.lg }}
              />
              <Text as="span">I agree to the {LEGAL_DOCUMENT_NAMES}</Text>
            </label>
            <Button
              type="submit"
              label={busy ? 'Saving…' : 'Agree and continue'}
              size="lg"
              disabled={!agreed || busy}
            />
            {error && (
              <Text role="alert" color="danger">
                {error}
              </Text>
            )}
            <Button
              type="button"
              label="Sign out"
              variant="secondary"
              onClick={() => void signOut()}
            />
          </form>
        </Card>
      </div>
    </main>
  );
};
