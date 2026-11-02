import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ContactSharing } from '@team-impact/contracts';
import { AthleteCard } from '@team-impact/ui-primitives/web';
import { colors, fontWeight, spacing, typography } from '@team-impact/ui-tokens';
import { toCardData } from '../../athleteCard';
import { api, track } from '../../api';
import { Form, FormError, useAction } from '../../forms';
import { Async, Button, Card, PageHeader, Select, Text } from '../../ui';
import { useApi } from '../../useApi';

/** R6: save the athlete to one of your lists (or one a colleague shared with you). */
const SaveToList = ({ athleteId }: { athleteId: string }) => {
  const { state } = useApi(() => api.lists());
  const { busy, error, run } = useAction();
  const [listId, setListId] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  if (state.status !== 'ready') return null;
  const lists = state.data;
  return (
    <Card style={{ padding: spacing.lg }}>
      <Text as="h2" variant="display" size="xs" color="brand">
        Save to a list
      </Text>
      {lists.length === 0 ? (
        <Text variant="small" color="muted">
          No lists yet. Create one under Lists.
        </Text>
      ) : (
        <Form
          onSubmit={() =>
            run(
              () => api.addToList(listId, athleteId),
              () => setSaved(lists.find((l) => l.id === listId)?.name ?? 'the list'),
            )
          }
        >
          <Select
            label="List"
            required
            value={listId}
            onChange={(e) => {
              setListId(e.target.value);
              setSaved(null);
            }}
          >
            <option value="">Pick a list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <FormError>{error}</FormError>
          {saved && (
            <Text role="status" variant="small" color="secondary">
              Saved to {saved}.
            </Text>
          )}
          <Button
            type="submit"
            label="Save"
            variant="secondary"
            size="sm"
            disabled={busy || !listId}
          />
        </Form>
      )}
    </Card>
  );
};

type Channel = keyof ContactSharing;

const HREF: Record<Channel, (value: string) => string> = {
  email: (v) => `mailto:${v}`,
  phone: (v) => `tel:${v.replace(/[^+\d]/g, '')}`,
  linkedin: (v) => (/^https?:\/\//.test(v) ? v : `https://${v}`),
};

/** A shared contact detail. Opening or copying it is logged as a contact view. */
const Row = ({
  label,
  channel,
  value,
  onOpen,
}: {
  label: string;
  channel: Channel;
  value: string | null | undefined;
  onOpen: (channel: Channel) => void;
}) =>
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
        <a
          href={HREF[channel](value)}
          target={channel === 'linkedin' ? '_blank' : undefined}
          rel="noreferrer"
          onClick={() => onOpen(channel)}
          onCopy={() => onOpen(channel)}
          style={{ color: colors.brand }}
        >
          {value}
        </a>
      </Text>
    </div>
  ) : null;

/** R5: an athlete's Impact Card with the contacts they chose to share with recruiters. */
export const AthletePage = () => {
  const { id = '' } = useParams();
  const { state } = useApi(() => api.card(id), [id]);
  const [flipped, setFlipped] = useState(false);
  const card = state.status === 'ready' ? state.data : null;

  // Logged when the card arrives rather than on mount, so StrictMode's double mount counts once.
  useEffect(() => {
    if (card) {
      track({ name: 'card.viewed', properties: { cardId: card.id }, subjectId: card.athleteId });
    }
  }, [card?.id]);

  const viewContact = (channel: Channel) =>
    card && track({ name: 'contact.viewed', properties: { channel }, subjectId: card.athleteId });

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
                <SaveToList athleteId={card.athleteId} />
                <Card style={{ padding: spacing.lg }}>
                  <Text as="h2" variant="display" size="xs" color="brand">
                    Contact
                  </Text>
                  <Text variant="caption" color="muted">
                    Only what {card.firstName} chose to share with recruiters. Reach out outside the
                    app.
                  </Text>
                  <dl style={{ margin: 0 }}>
                    <Row
                      label="Email"
                      channel="email"
                      value={card.contact.email}
                      onOpen={viewContact}
                    />
                    <Row
                      label="Phone"
                      channel="phone"
                      value={card.contact.phone}
                      onOpen={viewContact}
                    />
                    <Row
                      label="LinkedIn"
                      channel="linkedin"
                      value={card.contact.linkedinUrl}
                      onOpen={viewContact}
                    />
                  </dl>
                  {!card.contact.email && !card.contact.phone && !card.contact.linkedinUrl && (
                    <Text variant="small" color="muted">
                      No contact shared.
                    </Text>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </Async>
    </>
  );
};
