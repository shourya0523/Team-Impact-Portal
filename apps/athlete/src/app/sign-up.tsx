import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ageBand, ageOn, type SelfSignupRole, type SignupRequest } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import {
  CheckRow,
  errorMessage,
  formatDateInput,
  isCompleteDate,
  OptionRow,
} from '@/components/signup';
import { ErrorText, Gutter, Progress, Screen } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import { Button, Card, Input, Text } from '@/ui';

/** Adults pick one of these; 13–17 year olds are always teammates (`teen`). */
const ADULT_ROLES: { id: Exclude<SelfSignupRole, 'teen'>; label: string; note: string }[] = [
  { id: 'athlete', label: 'Athlete', note: 'On a college team' },
  { id: 'parent', label: 'Parent or guardian', note: 'Your child is on a team' },
  { id: 'alumni_athlete', label: 'Alumni athlete', note: 'You played in college' },
  { id: 'alumni_mentor', label: 'Alumni mentor', note: 'A Team IMPACT kid, back to mentor' },
];

type Step = 'birth' | 'role' | 'teen' | 'account';

/**
 * "/sign-up": birth date first, because it decides everything else. Under 13 never gets an
 * account (a parent signs up and adds them); 13–17 signs up as a teammate and confirms a parent or
 * guardian agreed; adults pick their role. Coaches join from their invite email and recruiters on
 * the portal. `?qr=<code>` returns to the scanned team afterwards.
 */
export default function SignUp() {
  const { qr } = useLocalSearchParams<{ qr?: string }>();
  const { setMe, setRole } = useRole();
  const [step, setStep] = useState<Step>('birth');
  const [birthDate, setBirthDate] = useState('');
  const [role, setChosen] = useState<SelfSignupRole | null>(null);
  const [parentAgreed, setParentAgreed] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isTeen = role === 'teen';
  const steps: Step[] = isTeen ? ['birth', 'teen', 'account'] : ['birth', 'role', 'account'];

  const afterBirth = () => {
    setError(null);
    const age = ageOn(birthDate);
    if (Number.isNaN(age) || age < 0 || age > 120) {
      setError('Check your birth date: year, month, day.');
      return;
    }
    const band = ageBand(age);
    if (band === 'child') {
      // No account under 13, and nothing typed is kept.
      setBirthDate('');
      router.replace('/onboarding/under-13');
      return;
    }
    if (band === 'teen') {
      setChosen('teen');
      setStep('teen');
    } else {
      if (role === 'teen') setChosen(null);
      setStep('role');
    }
  };

  const submit = () => {
    if (!role) return;
    const body: SignupRequest = {
      email,
      password,
      firstName,
      lastName,
      birthDate,
      role,
      acceptTerms: acceptTerms as true,
      ...(isTeen ? { parentAgreed: true as const } : {}),
    };
    setSending(true);
    setError(null);
    api.signUp(body).then(
      (me) => {
        setMe(me);
        setRole(me.role);
        const next: Href = qr
          ? { pathname: '/scan', params: { code: qr } }
          : me.role === 'athlete' || me.role === 'parent' || me.role === 'teen'
            ? '/onboarding/find-team'
            : firstTab(me.role);
        router.replace(next);
      },
      (e: unknown) => {
        setError(errorMessage(e));
        setSending(false);
      },
    );
  };

  const back = () => {
    setError(null);
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]!);
    else router.back();
  };

  const accountReady =
    firstName.trim() && lastName.trim() && email.includes('@') && password.length >= 12;

  return (
    <Screen
      eyebrow={`Create an account · ${steps.indexOf(step) + 1} of ${steps.length}`}
      title={
        step === 'birth'
          ? 'When’s your birthday?'
          : step === 'role'
            ? 'Who are you?'
            : step === 'teen'
              ? 'Joining as a teammate'
              : 'Your account'
      }
    >
      <Gutter gap="md">
        <Progress step={steps.indexOf(step) + 1} total={steps.length} />

        {step === 'birth' && (
          <>
            <Text color="secondary">
              We only use it to check your age. It’s never shown to anyone.
            </Text>
            <Input
              label="Birth date (YYYY-MM-DD)"
              value={birthDate}
              onChangeText={(v) => setBirthDate(formatDateInput(v))}
              placeholder="2005-04-21"
              keyboardType="number-pad"
              autoComplete="birthdate-full"
              maxLength={10}
            />
            <Button
              label="Continue"
              size="lg"
              disabled={!isCompleteDate(birthDate)}
              onPress={afterBirth}
            />
          </>
        )}

        {step === 'role' && (
          <>
            <View accessibilityRole="radiogroup" style={styles.list}>
              {ADULT_ROLES.map((r) => (
                <OptionRow
                  key={r.id}
                  label={r.label}
                  note={r.note}
                  selected={role === r.id}
                  onPress={() => setChosen(r.id)}
                />
              ))}
            </View>
            <Card>
              <Text variant="small" color="secondary">
                Coaches join from the invite Team IMPACT emails them. Recruiters sign up on the Team
                IMPACT portal with their work email.
              </Text>
            </Card>
            <Button
              label="Continue"
              size="lg"
              disabled={!role}
              onPress={() => setStep('account')}
            />
          </>
        )}

        {step === 'teen' && (
          <>
            <Text>
              You’re 13 to 17, so you’ll join as a teammate. Teammates see their team’s feed and
              events. Athletes’ contact details stay hidden, and you won’t show up in any search.
            </Text>
            <Card>
              <Text variant="eyebrow" color="secondary">
                Teen terms
              </Text>
              <Text variant="small" color="secondary">
                A parent or guardian needs to know you’re joining and agree to the Team IMPACT Terms
                and Privacy Policy with you.
              </Text>
              <CheckRow
                label="A parent or guardian agreed to me joining"
                checked={parentAgreed}
                onToggle={() => setParentAgreed((v) => !v)}
              />
            </Card>
            <Button
              label="Continue"
              size="lg"
              disabled={!parentAgreed}
              onPress={() => setStep('account')}
            />
          </>
        )}

        {step === 'account' && (
          <>
            <Input
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoComplete="given-name"
            />
            <Input
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoComplete="family-name"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Password (12 characters or more)"
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              secureTextEntry
            />
            <CheckRow
              label="I agree to the Terms and Privacy Policy"
              checked={acceptTerms}
              onToggle={() => setAcceptTerms((v) => !v)}
            />
            <Button
              label={sending ? 'Creating…' : 'Create account'}
              size="lg"
              disabled={!accountReady || !acceptTerms || sending || (isTeen && !parentAgreed)}
              onPress={submit}
            />
          </>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Back" variant="secondary" onPress={back} />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
