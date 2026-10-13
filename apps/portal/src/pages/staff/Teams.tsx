import { useState } from 'react';
import {
  DIVISIONS,
  TEAM_GENDERS,
  type Division,
  type Team,
  type TeamGender,
  type TeamStatus,
} from '@team-impact/contracts';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Actions, Form, FormError, useAction } from '../../forms';
import {
  Async,
  Badge,
  type BadgeProps,
  Button,
  formatDate,
  fullName,
  Input,
  PageHeader,
  Select,
  Sheet,
  Table,
  Text,
  Tile,
} from '../../ui';
import { useApi } from '../../useApi';

const STATUS: Record<TeamStatus, { label: string; tone: BadgeProps['variant'] }> = {
  live: { label: 'Live', tone: 'success' },
  invited: { label: 'Waiting on coach', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

/** S2: pick the college from the managed list; one team per college, sport and gender. */
const NewTeam = ({ onDone }: { onDone: () => void }) => {
  const colleges = useApi(() => api.staff.colleges());
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({
    collegeId: '',
    sport: '',
    gender: 'women' as TeamGender,
    name: '',
    division: 'III' as Division,
    firstCoachEmail: '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Form onSubmit={() => run(() => api.staff.createTeam(form), onDone)}>
      <Async state={colleges.state}>
        {(list) => (
          <Select
            label="College"
            required
            value={form.collegeId}
            onChange={(e) => set({ collegeId: e.target.value })}
          >
            <option value="">Pick a college</option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Async>
      <Input
        label="Sport"
        required
        value={form.sport}
        onChange={(e) => set({ sport: e.target.value })}
      />
      <Select
        label="Men’s or women’s"
        value={form.gender}
        onChange={(e) => set({ gender: e.target.value as TeamGender })}
      >
        {TEAM_GENDERS.map((g) => (
          <option key={g} value={g}>
            {g === 'men' ? 'Men’s' : 'Women’s'}
          </option>
        ))}
      </Select>
      <Input
        label="Display name"
        placeholder="Women's Soccer"
        required
        value={form.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <Select
        label="Division"
        value={form.division}
        onChange={(e) => set({ division: e.target.value as Division })}
      >
        {DIVISIONS.map((d) => (
          <option key={d} value={d}>
            Division {d}
          </option>
        ))}
      </Select>
      <Input
        label="First coach’s email"
        type="email"
        required
        value={form.firstCoachEmail}
        onChange={(e) => set({ firstCoachEmail: e.target.value })}
      />
      <Text variant="caption" color="muted">
        Creates the team’s private community and emails the coach a single-use invite, valid for 7
        days.
      </Text>
      <FormError>{error}</FormError>
      <Button type="submit" label="Create team and invite coach" disabled={busy} />
    </Form>
  );
};

/** Name and division; colour and logo come with uploads. */
const EditTeam = ({ team, onDone }: { team: Team; onDone: () => void }) => {
  const { busy, error, run } = useAction();
  const [name, setName] = useState(team.name);
  const [division, setDivision] = useState<Division>(team.division);
  return (
    <Form onSubmit={() => run(() => api.staff.updateTeam(team.id, { name, division }), onDone)}>
      <Input label="Display name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Select
        label="Division"
        value={division}
        onChange={(e) => setDivision(e.target.value as Division)}
      >
        {DIVISIONS.map((d) => (
          <option key={d} value={d}>
            Division {d}
          </option>
        ))}
      </Select>
      <FormError>{error}</FormError>
      <Button type="submit" label="Save" disabled={busy} />
    </Form>
  );
};

/** S8: a team's coaches and invites. Invites are single-use and expire after 7 days. */
const Coaches = ({ team }: { team: Team }) => {
  const { state, reload } = useApi(() => api.staff.coaches(team.id), [team.id]);
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState('');
  const inviteState = (i: {
    acceptedAt: string | null;
    revokedAt: string | null;
    expiresAt: string;
  }) =>
    i.acceptedAt
      ? 'Accepted'
      : i.revokedAt
        ? 'Revoked'
        : new Date(i.expiresAt) < new Date()
          ? 'Expired'
          : 'Pending';
  return (
    <>
      <Async state={state}>
        {({ coaches, invites }) => (
          <>
            <Text weight="semibold">Coaches</Text>
            {coaches.length ? (
              coaches.map((c) => (
                <Text key={c.user.id} variant="small">
                  {fullName(c.user)} · since {formatDate(c.joinedAt)}
                </Text>
              ))
            ) : (
              <Text variant="small" color="muted">
                No coach yet.
              </Text>
            )}
            <Text weight="semibold">Invites</Text>
            {invites.length === 0 && (
              <Text variant="small" color="muted">
                No invites sent.
              </Text>
            )}
            {invites.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <Text as="span" variant="small" style={{ flex: 1 }}>
                  {i.email} · {inviteState(i)} · sent {formatDate(i.createdAt)}
                </Text>
                {inviteState(i) === 'Pending' && (
                  <Button
                    label="Revoke"
                    variant="quiet"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => api.staff.revokeInvite(i.id), reload)}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </Async>
      {team.status !== 'archived' && (
        <Form
          onSubmit={() =>
            run(
              () => api.staff.inviteCoach(team.id, email),
              () => {
                setEmail('');
                reload();
              },
            )
          }
        >
          <Input
            label="Invite a coach by email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormError>{error}</FormError>
          <Button type="submit" label="Send invite" variant="secondary" disabled={busy} />
        </Form>
      )}
    </>
  );
};

type Open = { kind: 'new' } | { kind: 'edit' | 'coaches'; team: Team } | null;

/** S2, S7, S8: every team, creating one, editing, archiving and restoring, and its coaches. */
export const TeamsPage = () => {
  const { state, reload } = useApi(() => api.staff.teams());
  const [open, setOpen] = useState<Open>(null);
  const { busy, error, run } = useAction();
  const close = () => setOpen(null);
  const done = () => {
    close();
    reload();
  };

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Teams Team Impact has set up, by college."
        action={<Button label="New team" onClick={() => setOpen({ kind: 'new' })} />}
      />
      <FormError>{error}</FormError>
      <Async state={state}>
        {(teams) => (
          <Table
            rows={teams}
            rowKey={(t) => t.id}
            columns={[
              {
                header: 'Team',
                cell: (t) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
                    <Tile
                      text={`${t.gender === 'women' ? 'W' : 'M'}${t.sport[0] ?? ''}`}
                      teamColor={t.color}
                    />
                    <span style={{ fontWeight: fontWeight.semibold, color: colors.brand }}>
                      {t.name}
                    </span>
                  </span>
                ),
              },
              { header: 'College', cell: (t) => t.college.name },
              { header: 'Sport', cell: (t) => `${t.sport} · Division ${t.division}` },
              { header: 'Members', cell: (t) => t.memberCount, align: 'right' },
              {
                header: 'Status',
                cell: (t) => (
                  <Badge variant={STATUS[t.status].tone} label={STATUS[t.status].label} />
                ),
              },
              { header: 'Created', cell: (t) => formatDate(t.createdAt) },
              {
                header: 'Actions',
                align: 'right',
                cell: (t) => (
                  <Actions>
                    <Button
                      label="Coaches"
                      variant="quiet"
                      size="sm"
                      onClick={() => setOpen({ kind: 'coaches', team: t })}
                    />
                    <Button
                      label="Edit"
                      variant="quiet"
                      size="sm"
                      onClick={() => setOpen({ kind: 'edit', team: t })}
                    />
                    {t.status === 'archived' ? (
                      <Button
                        label="Restore"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => api.staff.updateTeam(t.id, { archived: false }), reload)
                        }
                      />
                    ) : (
                      <Button
                        label="Archive"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(() => api.staff.archiveTeam(t.id), reload)}
                      />
                    )}
                  </Actions>
                ),
              },
            ]}
          />
        )}
      </Async>
      <Sheet open={open?.kind === 'new'} title="New team" onClose={close}>
        {open?.kind === 'new' && <NewTeam onDone={done} />}
      </Sheet>
      <Sheet
        open={open?.kind === 'edit'}
        title={open && open.kind !== 'new' ? `Edit ${open.team.name}` : 'Edit team'}
        onClose={close}
      >
        {open?.kind === 'edit' && <EditTeam team={open.team} onDone={done} />}
      </Sheet>
      <Sheet
        open={open?.kind === 'coaches'}
        title={open && open.kind !== 'new' ? `${open.team.name}: coaches` : 'Coaches'}
        onClose={() => {
          close();
          reload();
        }}
      >
        {open?.kind === 'coaches' && <Coaches team={open.team} />}
      </Sheet>
    </>
  );
};
