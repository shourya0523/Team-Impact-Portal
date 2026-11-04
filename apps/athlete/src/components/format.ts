import {
  can,
  type CommunityKind,
  CREATABLE_COMMUNITY_KINDS,
  type FeatureFlags,
  type Me,
  type Role,
} from '@team-impact/contracts';

export const ROLE_LABEL: Record<Role, string> = {
  staff: 'Team Impact',
  coach: 'Coach',
  athlete: 'Athlete',
  parent: 'Parent',
  teen: 'Teammate',
  recruiter: 'Recruiter',
  alumni_athlete: 'Alumni',
  alumni_mentor: 'Alumni mentor',
};

export const KIND_LABEL: Record<CommunityKind, string> = {
  team: 'Team',
  team_impact: 'Team Impact',
  medical: 'Medical',
  interest: 'Interest',
};

/**
 * The kinds `me` may create now, by the shared `community.create` rule (PRD §5, §11). Flags not
 * loaded count as off, so a failed load never offers a hidden kind.
 */
export const creatableKinds = (me: Me | null, flags: FeatureFlags | undefined) =>
  CREATABLE_COMMUNITY_KINDS.filter(
    (kind) =>
      !!me && can(me, 'community.create', { kind, medicalEnabled: !!flags?.medicalCommunities }),
  );

/** A calendar date (`2026-11-30`) is read at local noon, so it never shifts a day by zone. */
const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);

export const shortDate = (iso: string) =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const monthDay = (iso: string) => {
  const d = toDate(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
};

/** "in 4 days", "tomorrow", "today". */
export const fromNow = (iso: string, now = new Date()) => {
  const days = Math.round(
    (toDate(iso).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
};

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
