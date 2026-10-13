import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AthleteCard } from '@team-impact/ui-primitives/web';
import { colors, fontWeight, spacing, typography } from '@team-impact/ui-tokens';
import { toCardData } from '../../athleteCard';
import { api } from '../../api';
import { Async, Button, Card, PageHeader, Text } from '../../ui';
import { useApi } from '../../useApi';

const Row = ({ label, value }: { label: string; value: string | null | undefined }) =>
  value ? (
    <div
      style={{
        display: 'flex',
        gap: spacing.md,
        padding: `${spacing.sm}px 0`,
        borderBottom: `1px solid ${colors.lineSoft}`,
      }}
    >
      <Text as="dt" variant="small" color="muted" style={{ width: 120, flexShrink: 0 }}>
        {label}
      </Text>
      <Text as="dd" variant="small">
        {value}
      </Text>
    </div>
  ) : null;

/** R5: an athlete's Baseball Card with the contacts they chose to share with recruiters. */
export const AthletePage = () => {
  const { id = '' } = useParams();
  const { state } = useApi(() => api.card(id), [id]);
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <Link
        to="/search"
        style={{
          color: colors.brand,
          fontSize: typography.small.fontSize,
          fontWeight: fontWeight.semibold,
        }}
      >
        ← Back to search
      </Link>
      <Async state={state}>
        {(card) => (
          <>
            <div style={{ height: spacing.md }} />
            <PageHeader
              title={`${card.firstName} ${card.lastName}`}
              subtitle={
                card.team ? `${card.team.college.name} · ${card.team.name}` : 'Team Impact alumni'
              }
            />
            <div
              style={{
                display: 'flex',
                gap: spacing.xl,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <AthleteCard
                  athlete={toCardData(card, card.contact)}
                  width={340}
                  flipped={flipped}
                  onFlippedChange={setFlipped}
                />
                <Button
                  label={flipped ? 'Show resume' : 'Show personal'}
                  variant="secondary"
                  size="sm"
                  onClick={() => setFlipped((f) => !f)}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.md,
                }}
              >
                <Card style={{ padding: spacing.lg }}>
                  <Text as="h2" variant="display" size="xs" color="brand">
                    Contact
                  </Text>
                  <Text variant="caption" color="muted">
                    Only what {card.firstName} chose to share with recruiters. Reach out outside the
                    app.
                  </Text>
                  <dl style={{ margin: 0 }}>
                    <Row label="Email" value={card.contact.email} />
                    <Row label="Phone" value={card.contact.phone} />
                    <Row label="LinkedIn" value={card.contact.linkedinUrl} />
                  </dl>
                  {!card.contact.email && !card.contact.phone && !card.contact.linkedinUrl && (
                    <Text variant="small" color="muted">
                      No contact shared.
                    </Text>
                  )}
                </Card>
                <Card style={{ padding: spacing.lg }}>
                  <Text as="h2" variant="display" size="xs" color="brand">
                    Card
                  </Text>
                  <dl style={{ margin: 0 }}>
                    <Row label="Major" value={card.major} />
                    <Row label="Class of" value={String(card.classYear)} />
                    <Row label="Position" value={card.position} />
                    <Row label="Hometown" value={card.hometown} />
                    <Row label="Experience" value={card.experience} />
                    <Row label="Looking for" value={card.lookingFor} />
                    <Row label="Skills" value={card.skills.join(', ')} />
                  </dl>
                </Card>
              </div>
            </div>
          </>
        )}
      </Async>
    </>
  );
};
