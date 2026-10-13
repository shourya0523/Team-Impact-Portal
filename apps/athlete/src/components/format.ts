import type { CommunityKind, Role } from '@team-impact/contracts';

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

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
