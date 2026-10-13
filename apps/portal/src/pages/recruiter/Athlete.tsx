import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AthleteCard } from '@team-impact/ui-primitives/web';
import { fontSize, spacing } from '@team-impact/ui-tokens';
import { toCardData } from '../../athleteCard';
import { api } from '../../api';
import { Async, brand, button, PageHeader, Panel } from '../../ui';
import { useApi } from '../../useApi';

const Row = ({ label, value }: { label: string; value: string | null | undefined }) =>
  value ? (
    <div
      style={{
        display: 'flex',
        gap: spacing.md,
        padding: '8px 0',
        borderBottom: `1px solid ${brand.border}`,
      }}
    >
      <dt style={{ width: 120, flexShrink: 0, color: brand.muted, fontSize: fontSize.sm }}>
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: fontSize.sm, color: brand.ink }}>{value}</dd>
    </div>
  ) : null;

/** R5: an athlete's Baseball Card with the contacts they chose to share with recruiters. */
export const AthletePage = () => {
  const { id = '' } = useParams();
  const { state } = useApi(() => api.card(id), [id]);
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <Link to="/search" style={{ color: brand.navy, fontSize: fontSize.sm, fontWeight: 700 }}>
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
                <button
                  type="button"
                  style={button('secondary')}
                  onClick={() => setFlipped((f) => !f)}
                >
                  {flipped ? 'Show resume' : 'Show personal'}
                </button>
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
                <Panel style={{ padding: spacing.lg }}>
                  <h2 style={{ margin: 0, fontSize: fontSize.md, color: brand.navy }}>Contact</h2>
                  <p style={{ margin: '4px 0 8px', fontSize: 12, color: brand.muted }}>
                    Only what {card.firstName} chose to share with recruiters. Reach out outside the
                    app.
                  </p>
                  <dl style={{ margin: 0 }}>
                    <Row label="Email" value={card.contact.email} />
                    <Row label="Phone" value={card.contact.phone} />
                    <Row label="LinkedIn" value={card.contact.linkedinUrl} />
                  </dl>
                  {!card.contact.email && !card.contact.phone && !card.contact.linkedinUrl && (
                    <p style={{ fontSize: fontSize.sm, color: brand.muted }}>No contact shared.</p>
                  )}
                </Panel>
                <Panel style={{ padding: spacing.lg }}>
                  <h2 style={{ margin: 0, fontSize: fontSize.md, color: brand.navy }}>Card</h2>
                  <dl style={{ margin: '8px 0 0' }}>
                    <Row label="Major" value={card.major} />
                    <Row label="Class of" value={String(card.classYear)} />
                    <Row label="Position" value={card.position} />
                    <Row label="Hometown" value={card.hometown} />
                    <Row label="Experience" value={card.experience} />
                    <Row label="Looking for" value={card.lookingFor} />
                    <Row label="Skills" value={card.skills.join(', ')} />
                  </dl>
                </Panel>
              </div>
            </div>
          </>
        )}
      </Async>
    </>
  );
};
