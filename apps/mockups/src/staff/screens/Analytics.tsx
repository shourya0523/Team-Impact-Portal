import { useState } from 'react';
import { useWorld, visibleToRecruiters } from '../../shared/store';
import { Box, H2, PageHead, Stat, StatGrid } from '../kit';

type Range = '7' | '30' | 'all';
const SHARE: Record<Range, number> = { '7': 0.2, '30': 0.55, all: 1 };
const RANGE_LABEL: Record<Range, string> = {
  '7': 'last 7 days',
  '30': 'last 30 days',
  all: 'all time',
};

export function Analytics() {
  const { world } = useWorld();
  const [range, setRange] = useState<Range>('30');

  const live = world.teams.filter((t) => t.registered);
  const members = live.reduce((n, t) => n + t.members, 0);
  const published = world.athletes.filter((a) => a.published).length;
  const open = visibleToRecruiters(world).length;
  const posts = world.posts.filter((p) => !p.hidden).length;
  const openTickets = world.tickets.filter((t) => t.status === 'open').length;
  const recruiters = world.companies
    .filter((c) => c.status === 'active')
    .reduce((n, c) => n + c.recruiters, 0);
  const approved = (role: string) =>
    world.joinRequests.filter((r) => r.role === role && r.status === 'approved').length;

  // Sign-ups by role, derived from the shared world so it moves when other surfaces change things.
  const parents = 9 + approved('parent');
  const teens = 2 + approved('teen');
  const coaches = live.length;
  const athletes = Math.max(0, members - parents - teens - coaches);
  const share = SHARE[range];
  const roles = (
    [
      ['Athletes', athletes],
      ['Parents', parents],
      ['Teens', teens],
      ['Coaches', coaches],
      ['Recruiters', recruiters],
    ] as const
  ).map(([label, n]) => ({ label, n: Math.round(n * share) }));
  const max = Math.max(1, ...roles.map((r) => r.n));

  return (
    <>
      <PageHead
        title="Analytics"
        action={
          <>
            <label htmlFor="range" className="sr-only">
              Time range
            </label>
            <select
              id="range"
              className="select"
              style={{ width: 'auto', minWidth: 170 }}
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </>
        }
      />
      <StatGrid>
        <Stat label="Total members" value={members} sub={`${live.length} live teams`} />
        <Stat label="Cards published" value={published} />
        <Stat label="Open to recruiting" value={open} sub="Visible on the employer portal" />
        <Stat label="Posts" value={posts} />
        <Stat label="Events" value={world.events.length} />
        <Stat label="Open reports" value={openTickets} />
      </StatGrid>
      <Box gap={14} style={{ padding: 20 }}>
        <div className="row between wrap g8">
          <H2>Sign-ups by role</H2>
          <span className="tiny">{RANGE_LABEL[range]}</span>
        </div>
        {roles.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px minmax(0, 1fr) 48px',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
            <div
              style={{ height: 18, borderRadius: 4, background: 'var(--line-soft)' }}
              role="img"
              aria-label={`${r.label}: ${r.n}`}
            >
              <div
                style={{
                  height: 18,
                  borderRadius: 4,
                  background: i === 0 ? 'var(--red)' : 'var(--navy)',
                  width: Math.round((r.n / max) * 100) + '%',
                  transition: 'width 300ms var(--ease)',
                }}
              />
            </div>
            <div style={{ fontSize: 14, textAlign: 'right' }}>{r.n}</div>
          </div>
        ))}
        <div className="tiny">
          Children under 13 are not counted as members. Their parent’s account is.
        </div>
      </Box>
    </>
  );
}
