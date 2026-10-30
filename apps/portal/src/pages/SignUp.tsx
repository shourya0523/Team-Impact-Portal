import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  CURRENT_TERMS_VERSION,
  emailDomain,
  isPersonalEmailDomain,
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_NAMES,
  LEGAL_DOCUMENTS,
  type RecruiterSignupResult,
} from '@team-impact/contracts';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '../api';
import { Button, Card, Input, Logo, Text } from '../ui';

const messageOf = (e: unknown) => {
  if (e instanceof ApiRequestError) {
    const issues = e.body.error.issues?.map((i) => i.message) ?? [];
    return issues.length ? issues.join(' ') : e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
};

/**
 * "/sign-up": recruiters at partner companies sign up with their work email. The domain names the
 * company, which must be a partner and not suspended. They wait in `pending`, with no access to
 * athletes, until Team Impact staff approve them. The request names the version of the legal text
 * shown here, which the API stores with the acceptance (TI-107).
 */
export const SignUpPage = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RecruiterSignupResult | null>(null);

  const personal = email.includes('@') && isPersonalEmailDomain(emailDomain(email));
  const ready =
    firstName.trim() &&
    lastName.trim() &&
    email.includes('@') &&
    !personal &&
    password.length >= 12 &&
    acceptTerms;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    api
      .recruiterSignUp({
        firstName,
        lastName,
        email,
        password,
        acceptTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
        ...(title.trim() ? { title: title.trim() } : {}),
      })
      .then(setDone, (err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexWrap: 'wrap' }}>
      <div
        style={{
          flex: '1 1 320px',
          maxWidth: 560,
          background: colors.brand,
          padding: spacing['3xl'],
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: spacing.lg,
        }}
      >
        <Logo size="md" variant="dark" />
        <Text variant="eyebrow" color="on-brand-secondary">
          Team IMPACT portal
        </Text>
        <Text variant="display" size="xl" color="on-brand">
          Recruit athletes who show up for their team.
        </Text>
        <Text color="on-brand-secondary" style={{ maxWidth: 420 }}>
          For recruiters at Team Impact partner companies. Use your work email: its domain tells us
          your company.
        </Text>
      </div>

      <main
        style={{
          flex: '2 1 360px',
          background: colors.ground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <div style={{ width: '100%', maxWidth: 460 }}>
          {done ? (
            <Card>
              <Text variant="eyebrow" color="secondary">
                Pending approval
              </Text>
              <Text
                as="h2"
                variant="display"
                size="md"
                color="brand"
                style={{ margin: `${spacing.sm}px 0` }}
              >
                Thanks, you’re in the queue
              </Text>
              <Text>
                Team Impact staff check every recruiter at {done.company.name}. We’ll email{' '}
                {done.email} once you’re approved; until then you can’t search athletes.
              </Text>
              <p style={{ marginTop: spacing.lg }}>
                <Link to="/sign-in">Back to sign in</Link>
              </p>
            </Card>
          ) : (
            <form
              onSubmit={submit}
              style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
            >
              <Text variant="eyebrow" color="secondary">
                Recruiters
              </Text>
              <Text as="h2" variant="display" size="md" color="brand" style={{ margin: 0 }}>
                Create your account
              </Text>
              <Input
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
              <Input
                label="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                error={
                  personal
                    ? 'Personal email addresses can’t be used. Use your work email.'
                    : undefined
                }
              />
              <Input
                label="Job title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="organization-title"
              />
              <Input
                label="Password (12 characters or more)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
              <section aria-label="Legal terms">
                <Text variant="small" color="secondary">
                  Before you request access, read the{' '}
                  {LEGAL_DOCUMENT_IDS.map((doc, i) => (
                    <span key={doc}>
                      {i > 0 && (i === LEGAL_DOCUMENT_IDS.length - 1 ? ' and ' : ', ')}
                      <strong>{LEGAL_DOCUMENTS[doc].title}</strong>
                    </span>
                  ))}{' '}
                  (version {CURRENT_TERMS_VERSION}). They cover how you may use athletes’ contact
                  details and identity search, and that every identity search is logged.
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
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  style={{ accentColor: colors.brand, width: spacing.lg, height: spacing.lg }}
                />
                <Text as="span">I agree to the {LEGAL_DOCUMENT_NAMES}</Text>
              </label>
              <Button
                type="submit"
                label={busy ? 'Sending…' : 'Request access'}
                size="lg"
                disabled={!ready || busy}
              />
              {error && (
                <Text role="alert" color="danger">
                  {error}
                </Text>
              )}
              <Text variant="small" color="secondary">
                Already approved? <Link to="/sign-in">Sign in</Link>
              </Text>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
