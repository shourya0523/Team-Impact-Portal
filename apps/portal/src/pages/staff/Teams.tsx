import { useId, useState } from 'react';
import {
  DIVISIONS,
  SPORTS,
  TEAM_GENDERS,
  type CoachInvite,
  type College,
  type Division,
  type Sport,
  type StaffUpdateTeamRequest,
  type Team,
  type TeamGender,
  type TeamStatus,
} from '@team-impact/contracts';
import { colors, fontWeight, isReadableTeamColor, spacing } from '@team-impact/ui-tokens';
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

const isSport = (s: string): s is Sport => (SPORTS as readonly string[]).includes(s);

/** Why a typed team colour can't be used, or undefined. Blank means Team Impact navy. */
const colorProblem = (typed: string) =>
  !typed
    ? undefined
    : !/^#[0-9a-fA-F]{6}$/.test(typed)
      ? `Use a 6-digit hex colour like ${colors.brand}`
      : !isReadableTeamColor(typed)
        ? 'Names can’t be read on this colour in white or dark text. Pick a darker or lighter one.'
        : undefined;

type Fields = {
  collegeId: string;
  sport: string;
  gender: TeamGender;
  name: string;
  division: Division;
  /** As typed; blank means navy. */
  color: string;
};

/** One team per college, sport and gender (PRD §3): the team this one would duplicate, if any. */
const duplicateOf = (teams: Team[], f: Fields, except?: string) =>
  teams.find(
    (t) =>
      t.id !== except &&
      t.college.id === f.collegeId &&
      t.sport.toLowerCase() === f.sport.toLowerCase() &&
      t.gender === f.gender,
  );

/** S2 and S7: every field staff set on a team, with the duplicate and colour checks. */
const TeamFields = ({
  form,
  set,
  colleges,
  duplicate,
  onOpenTeam,
}: {
  form: Fields;
  set: (patch: Partial<Fields>) => void;
  colleges: College[];
  duplicate: Team | undefined;
  onOpenTeam: (t: Team) => void;
}) => {
  const typedColor = form.color.trim();
  const colorError = colorProblem(typedColor);
  // A team made before the sport list existed keeps its sport until staff pick a listed one.
  const sports: readonly string[] =
    isSport(form.sport) || !form.sport ? SPORTS : [form.sport, ...SPORTS];
  return (
    <>
      <Select
        label="College"
        required
        value={form.collegeId}
        onChange={(e) => set({ collegeId: e.target.value })}
      >
        <option value="">Pick a college</option>
        {colleges.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        label="Sport"
        required
        value={form.sport}
        onChange={(e) => set({ sport: e.target.value })}
      >
        <option value="">Pick a sport</option>
        {sports.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
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
      {duplicate && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Text as="span" variant="small" weight="medium" color="danger" style={{ flex: 1 }}>
            {duplicate.college.name} already has this team: {duplicate.name}.
          </Text>
          <Button
            label={`Open ${duplicate.name}`}
            variant="quiet"
            size="sm"
            onClick={() => onOpenTeam(duplicate)}
          />
        </div>
      )}
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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.sm }}>
        <div style={{ flex: 1 }}>
          <Input
            label="Team colour (optional)"
            placeholder={colors.brand}
            value={form.color}
            error={colorError}
            onChange={(e) => set({ color: e.target.value })}
          />
        </div>
        <Tile text="Aa" teamColor={colorError ? null : typedColor || null} size="md" />
      </div>
      <Text variant="caption" color="muted">
        The team’s avatar and Baseball Card stripe. Leave it blank for Team Impact navy. The logo
        comes with uploads.
      </Text>
    </>
  );
};

/** S2: pick the college from the managed list; one team per college, sport and gender. */
const NewTeam = ({
  teams,
  onDone,
  onStale,
  onOpenTeam,
}: {
  teams: Team[];
  onDone: () => void;
  /** Reloads the team list, so a duplicate the server caught shows its link here too. */
  onStale: () => void;
  onOpenTeam: (t: Team) => void;
}) => {
  const colleges = useApi(() => api.staff.colleges());
  const { busy, error, run } = useAction();
  const [form, setForm] = useState<Fields>({
    collegeId: '',
    sport: '',
    gender: 'women',
    name: '',
    division: 'III',
    color: '',
  });
  const [firstCoachEmail, setFirstCoachEmail] = useState('');
  const set = (patch: Partial<Fields>) => setForm((f) => ({ ...f, ...patch }));
  const duplicate = duplicateOf(teams, form);
  const typedColor = form.color.trim();
  // The sport select is required, so the browser asks for one; only real problems block saving.
  const blocked = !!duplicate || !!colorProblem(typedColor);
  return (
    <Form
      onSubmit={() => {
        const { sport } = form;
        if (blocked || !isSport(sport)) return;
        void run(
          () =>
            api.staff
              .createTeam({
                collegeId: form.collegeId,
                sport,
                gender: form.gender,
                name: form.name,
                division: form.division,
                ...(typedColor ? { color: typedColor.toUpperCase() } : {}),
                firstCoachEmail,
              })
              .catch((e: unknown) => {
                onStale();
                throw e;
              }),
          onDone,
        );
      }}
    >
      <Async state={colleges.state}>
        {(list) => (
          <TeamFields
            form={form}
            set={set}
            colleges={list}
            duplicate={duplicate}
            onOpenTeam={onOpenTeam}
          />
        )}
      </Async>
      <Input
        label="First coach’s email"
        type="email"
        required
        value={firstCoachEmail}
        onChange={(e) => setFirstCoachEmail(e.target.value)}
      />
      <Text variant="caption" color="muted">
        Creates the team’s private community and emails the coach a single-use invite, valid for 7
        days.
      </Text>
      <FormError>{error}</FormError>
      <Button type="submit" label="Create team and invite coach" disabled={busy || blocked} />
    </Form>
  );
};

/** S7: staff edit every field set at creation. Only what changed is sent, and logged. */
const EditTeam = ({
  team,
  teams,
  onDone,
  onStale,
  onOpenTeam,
}: {
  team: Team;
  teams: Team[];
  onDone: () => void;
  onStale: () => void;
  onOpenTeam: (t: Team) => void;
}) => {
  const colleges = useApi(() => api.staff.colleges());
  const { busy, error, run } = useAction();
  const [form, setForm] = useState<Fields>({
    collegeId: team.college.id,
    sport: team.sport,
    gender: team.gender,
    name: team.name,
    division: team.division,
    color: team.color ?? '',
  });
  const set = (patch: Partial<Fields>) => setForm((f) => ({ ...f, ...patch }));
  const duplicate = duplicateOf(teams, form, team.id);
  const typedColor = form.color.trim();
  const blocked = !!duplicate || !!colorProblem(typedColor);

  const changes = (): StaffUpdateTeamRequest => {
    // Stored upper case, as the athlete app sends it, so a case change isn't logged as an edit.
    const color = typedColor ? typedColor.toUpperCase() : null;
    return {
      ...(form.collegeId !== team.college.id && { collegeId: form.collegeId }),
      ...(form.sport !== team.sport && isSport(form.sport) && { sport: form.sport }),
      ...(form.gender !== team.gender && { gender: form.gender }),
      ...(form.name !== team.name && { name: form.name }),
      ...(form.division !== team.division && { division: form.division }),
      ...(color !== (team.color?.toUpperCase() ?? null) && { color }),
    };
  };

  return (
    <Form
      onSubmit={() => {
        if (blocked) return;
        const body = changes();
        void run(
          () =>
            Object.keys(body).length
              ? api.staff.updateTeam(team.id, body).catch((e: unknown) => {
                  onStale();
                  throw e;
                })
              : Promise.resolve(),
          onDone,
        );
      }}
    >
      <Async state={colleges.state}>
        {(list) => (
          <TeamFields
            form={form}
            set={set}
            colleges={list}
            duplicate={duplicate}
            onOpenTeam={onOpenTeam}
          />
        )}
      </Async>
      <FormError>{error}</FormError>
      <Button type="submit" label="Save" disabled={busy || blocked} />
    </Form>
  );
};

const inviteState = (i: CoachInvite) =>
  i.acceptedAt
    ? 'Accepted'
    : i.revokedAt
      ? 'Revoked'
      : new Date(i.expiresAt) < new Date()
        ? 'Expired'
        : 'Pending';

/** S8: a team's coaches and invites. Invites are single-use and expire after 7 days. */
const Coaches = ({ team }: { team: Team }) => {
  const { state, reload } = useApi(() => api.staff.coaches(team.id), [team.id]);
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState('');
  const archived = team.status === 'archived';
  const ruleId = useId();
  return (
    <>
      <FormError>{error}</FormError>
      <Async state={state}>
        {({ coaches, invites }) => {
          const activeCount = coaches.filter((c) => !c.suspended).length;
          // The newest invite per email is the one a resend replaces; older ones are history.
          const latest = new Set(
            invites
              .filter((i, n) => invites.findIndex((o) => o.email === i.email) === n)
              .map((i) => i.id),
          );
          return (
            <>
              <Text weight="semibold">Coaches</Text>
              {coaches.length ? (
                coaches.map((c) => {
                  const lastActive = team.status === 'live' && !c.suspended && activeCount === 1;
                  return (
                    <div
                      key={c.user.id}
                      style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}
                    >
                      <Text as="span" variant="small" style={{ flex: 1 }}>
                        {fullName(c.user)} · since {formatDate(c.joinedAt)}
                      </Text>
                      {c.suspended && <Badge variant="warning" label="Suspended" />}
                      <Button
                        label="Remove"
                        variant="quiet"
                        size="sm"
                        disabled={busy || lastActive}
                        title={lastActive ? 'Add another coach first' : undefined}
                        aria-describedby={lastActive ? ruleId : undefined}
                        aria-label={`Remove ${fullName(c.user)} as a coach`}
                        onClick={() => run(() => api.staff.removeCoach(team.id, c.user.id), reload)}
                      />
                    </div>
                  );
                })
              ) : (
                <Text variant="small" color="muted">
                  No coach yet.
                </Text>
              )}
              <Text id={ruleId} variant="caption" color="muted">
                A live team always keeps at least one coach. Add another before removing the last
                one.
              </Text>
              <Text weight="semibold">Invites</Text>
              {invites.length === 0 && (
                <Text variant="small" color="muted">
                  No invites sent.
                </Text>
              )}
              {invites.map((i) => {
                const s = inviteState(i);
                return (
                  <div
                    key={i.id}
                    style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}
                  >
                    <div style={{ flex: 1 }}>
                      <Text variant="small">
                        {i.email} · {s}
                      </Text>
                      <Text variant="caption" color="muted">
                        Sent {formatDate(i.createdAt)} by {fullName(i.invitedBy)}
                        {s === 'Pending' || s === 'Expired'
                          ? ` · ${s === 'Pending' ? 'expires' : 'expired'} ${formatDate(i.expiresAt)}`
                          : ''}
                      </Text>
                    </div>
                    {(s === 'Pending' || s === 'Expired') && latest.has(i.id) && !archived && (
                      <Button
                        label="Resend"
                        variant="quiet"
                        size="sm"
                        disabled={busy}
                        aria-label={`Resend the invite to ${i.email}`}
                        onClick={() => run(() => api.staff.resendInvite(i.id), reload)}
                      />
                    )}
                    {s === 'Pending' && (
                      <Button
                        label="Revoke"
                        variant="quiet"
                        size="sm"
                        disabled={busy}
                        aria-label={`Revoke the invite to ${i.email}`}
                        onClick={() => run(() => api.staff.revokeInvite(i.id), reload)}
                      />
                    )}
                  </div>
                );
              })}
            </>
          );
        }}
      </Async>
      {!archived && (
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
          <Button type="submit" label="Send invite" variant="secondary" disabled={busy} />
        </Form>
      )}
    </>
  );
};

/** Archiving closes things restoring doesn't reopen, so it asks first. */
const ArchiveTeam = ({ team, onDone }: { team: Team; onDone: () => void }) => {
  const { busy, error, run } = useAction();
  return (
    <Form onSubmit={() => run(() => api.staff.archiveTeam(team.id), onDone)}>
      <Text variant="small">
        {team.name} leaves the join search. Its pending join requests are declined, and its QR codes
        are turned off for good: restoring the team won’t bring them back. Members keep the team,
        its community and its roster.
      </Text>
      <FormError>{error}</FormError>
      <Button type="submit" label="Archive team" disabled={busy} />
    </Form>
  );
};

type Open = { kind: 'new' } | { kind: 'edit' | 'coaches' | 'archive'; team: Team } | null;

/** S2, S7, S8: every team, creating one, editing, archiving and restoring, and its coaches. */
export const TeamsPage = () => {
  const { state, reload } = useApi(() => api.staff.teams());
  const [open, setOpen] = useState<Open>(null);
  const { busy, error, run } = useAction();
  const teams = state.status === 'ready' ? state.data : [];
  const close = () => setOpen(null);
  const done = () => {
    close();
    reload();
  };
  const openTeam = (team: Team) => setOpen({ kind: 'edit', team });
  const sheetTeam = open && open.kind !== 'new' ? open.team : null;

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Teams Team Impact has set up, by college."
        action={<Button label="New team" onClick={() => setOpen({ kind: 'new' })} />}
      />
      <FormError>{error}</FormError>
      <Async state={state}>
        {(list) => (
          <Table
            rows={list}
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
                      aria-label={`Coaches of ${t.name}`}
                      onClick={() => setOpen({ kind: 'coaches', team: t })}
                    />
                    <Button
                      label="Edit"
                      variant="quiet"
                      size="sm"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => openTeam(t)}
                    />
                    {t.status === 'archived' ? (
                      <Button
                        label="Restore"
                        aria-label={`Restore ${t.name}`}
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
                        aria-label={`Archive ${t.name}`}
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => setOpen({ kind: 'archive', team: t })}
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
        {open?.kind === 'new' && (
          <NewTeam teams={teams} onDone={done} onStale={reload} onOpenTeam={openTeam} />
        )}
      </Sheet>
      <Sheet
        open={open?.kind === 'edit'}
        title={sheetTeam ? `Edit ${sheetTeam.name}` : 'Edit team'}
        onClose={close}
      >
        {open?.kind === 'edit' && (
          // Keyed so opening a different team (from a duplicate warning) starts a fresh form.
          <EditTeam
            key={open.team.id}
            team={open.team}
            teams={teams}
            onDone={done}
            onStale={reload}
            onOpenTeam={openTeam}
          />
        )}
      </Sheet>
      <Sheet
        open={open?.kind === 'coaches'}
        title={sheetTeam ? `${sheetTeam.name}: coaches` : 'Coaches'}
        onClose={() => {
          close();
          reload();
        }}
      >
        {open?.kind === 'coaches' && <Coaches team={open.team} />}
      </Sheet>
      <Sheet
        open={open?.kind === 'archive'}
        title={sheetTeam ? `Archive ${sheetTeam.name}?` : 'Archive team?'}
        onClose={close}
      >
        {open?.kind === 'archive' && <ArchiveTeam team={open.team} onDone={done} />}
      </Sheet>
    </>
  );
};
