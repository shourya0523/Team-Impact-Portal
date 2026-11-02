import { router } from 'expo-router';
import { useState } from 'react';
import type { ContactSharing, MySettings, UpdateMySettingsRequest } from '@team-impact/contracts';
import { api, ApiRequestError } from '@/api';
import { SwitchRow } from '@/components/SwitchRow';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Input, Text } from '@/ui';

const CHANNELS: { key: keyof ContactSharing; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'linkedin', label: 'LinkedIn' },
];

function Sharing({
  value,
  onChange,
}: {
  value: ContactSharing;
  onChange: (patch: Partial<ContactSharing>) => void;
}) {
  return (
    <Card>
      {CHANNELS.map((c) => (
        <SwitchRow
          key={c.key}
          label={c.label}
          value={value[c.key]}
          onChange={(on) => onChange({ [c.key]: on })}
        />
      ))}
    </Card>
  );
}

function ContactForm({
  contact,
  onSave,
}: {
  contact: NonNullable<MySettings['contact']>;
  onSave: (body: UpdateMySettingsRequest) => Promise<unknown>;
}) {
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [linkedin, setLinkedin] = useState(contact.linkedinUrl ?? '');
  const [saved, setSaved] = useState(false);
  const save = () =>
    onSave({
      contact: {
        email: email.trim() || null,
        phone: phone.trim() || null,
        linkedinUrl: linkedin.trim() || null,
      },
    }).then(() => setSaved(true));
  return (
    <Card>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input
        label="LinkedIn"
        value={linkedin}
        onChangeText={setLinkedin}
        autoCapitalize="none"
        placeholder="linkedin.com/in/you"
      />
      <Button
        label={saved ? 'Saved' : 'Save details'}
        variant="secondary"
        size="sm"
        onPress={save}
      />
    </Card>
  );
}

/**
 * "/me/recruiting": which details families on the team see, which recruiters see, and the
 * open-to-recruiting switch (PRD A2, A5). Athletes only; the API refuses everyone else.
 */
export default function Recruiting() {
  const { state } = useApi(() => api.settings());
  const [override, setOverride] = useState<MySettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (body: UpdateMySettingsRequest) =>
    api.updateSettings(body).then(
      (s) => {
        setError(null);
        setOverride(s);
      },
      (e: Error) =>
        setError(
          e instanceof ApiRequestError && e.body.error.issues?.[0]
            ? e.body.error.issues[0].message
            : e.message,
        ),
    );

  return (
    <Screen eyebrow="Me" title="Contacts and recruiting" back>
      <Async state={state}>
        {(loaded) => {
          const s = override ?? loaded;
          if (!s.contact || !s.familiesSee || !s.recruitersSee) {
            return (
              <Gutter>
                <Card>
                  <Text weight="semibold">Your Impact Card comes first</Text>
                  <Text variant="small" color="secondary">
                    Families and recruiters reach you through the details on your card. Build it,
                    then choose who sees what here.
                  </Text>
                  <Button label="Build my card" onPress={() => router.push('/card')} />
                </Card>
              </Gutter>
            );
          }
          return (
            <Gutter>
              <Text color="secondary">
                There’s no messaging in the app: people reach you through the details you share.
                Teen teammates never see them.
              </Text>

              <SectionLabel>Your details</SectionLabel>
              <ContactForm contact={s.contact} onSave={update} />

              <SectionLabel>Families on your team see</SectionLabel>
              <Sharing value={s.familiesSee} onChange={(p) => update({ familiesSee: p })} />

              <SectionLabel>Recruiting</SectionLabel>
              <Card>
                <SwitchRow
                  label="Open to recruiting"
                  detail={
                    s.openToRecruiting.reason ??
                    (s.openToRecruiting.on
                      ? 'Partner recruiters can find your published card.'
                      : 'Off: you don’t appear on the employer portal at all.')
                  }
                  value={s.openToRecruiting.on}
                  disabled={!s.openToRecruiting.allowed && !s.openToRecruiting.on}
                  onChange={(on) => update({ openToRecruiting: on })}
                />
              </Card>

              <SectionLabel>Recruiters see</SectionLabel>
              <Text variant="small" color="secondary">
                Only while you’re open to recruiting.
              </Text>
              <Sharing value={s.recruitersSee} onChange={(p) => update({ recruitersSee: p })} />

              {error && <ErrorText>{error}</ErrorText>}
              <Button
                label="Privacy and search"
                variant="secondary"
                onPress={() => router.push('/me/privacy')}
              />
            </Gutter>
          );
        }}
      </Async>
    </Screen>
  );
}
