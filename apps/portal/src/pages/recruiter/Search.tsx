import type { CSSProperties, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { type AthleteSearchQuery, DIVISIONS, REGIONS } from '@team-impact/contracts';
import { fontSize, spacing } from '@team-impact/ui-tokens';
import { regionName } from '../../athleteCard';
import { api } from '../../api';
import { useSession } from '../../session';
import { Async, brand, button, PageHeader, Panel, Tile } from '../../ui';
import { useApi } from '../../useApi';

const FILTER_KEYS = [
  'region',
  'city',
  'sport',
  'major',
  'classYear',
  'division',
  'experience',
  'communityId',
] as const;
type Filters = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

const field: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 38,
  padding: '0 10px',
  borderRadius: 8,
  border: `1px solid ${brand.border}`,
  background: '#FFFFFF',
  fontSize: fontSize.sm,
  color: brand.ink,
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: brand.ink }}>{label}</span>
    {children}
  </label>
);

/**
 * R2–R4: dense results grid with a persistent filter rail. Filters live in the URL, so a search
 * can be shared or reloaded. The official-community filter (R3) shows only while the identity
 * search flag is on, and offers official interest communities only.
 */
export const SearchPage = () => {
  const { flags } = useSession();
  const [params, setParams] = useSearchParams();
  const filters: Filters = Object.fromEntries(
    FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined]).filter(([, v]) => v),
  );
  const key = params.toString();

  const results = useApi(
    () => api.searchAthletes(filters as Omit<AthleteSearchQuery, 'cursor' | 'limit'>),
    [key],
  );
  const officialCommunities = useApi(
    () =>
      flags?.identitySearch
        ? api.communities().then((all) => all.filter((c) => c.kind === 'interest' && c.official))
        : Promise.resolve([]),
    [flags?.identitySearch],
  );

  const set = (k: keyof Filters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(k, value);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const text = (k: keyof Filters, placeholder: string) => (
    <input
      style={field}
      defaultValue={filters[k] ?? ''}
      placeholder={placeholder}
      // Search as the recruiter finishes typing a value, not on every key.
      onBlur={(e) => set(k, e.target.value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && set(k, e.currentTarget.value.trim())}
    />
  );

  return (
    <>
      <PageHeader
        title="Search athletes"
        subtitle="Athletes with a published Baseball Card who are open to recruiting."
      />
      <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'flex-start' }}>
        <Panel style={{ width: 248, flexShrink: 0, padding: spacing.md }}>
          <form
            // Remount on every change so the text boxes show the URL's values, e.g. after Clear.
            key={key}
            aria-label="Filters"
            onSubmit={(e) => e.preventDefault()}
            style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
          >
            <Field label="Region">
              <select
                style={field}
                value={filters.region ?? ''}
                onChange={(e) => set('region', e.target.value)}
              >
                <option value="">Any</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {regionName(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="City">{text('city', 'e.g. Boston')}</Field>
            <Field label="Sport">{text('sport', 'e.g. Soccer')}</Field>
            <Field label="Major">{text('major', 'e.g. Economics')}</Field>
            <Field label="Grad year">{text('classYear', 'e.g. 2027')}</Field>
            <Field label="Division">
              <select
                style={field}
                value={filters.division ?? ''}
                onChange={(e) => set('division', e.target.value)}
              >
                <option value="">Any</option>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    Division {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Experience">{text('experience', 'e.g. internship')}</Field>
            {flags?.identitySearch && (
              <Field label="Official community">
                <Async state={officialCommunities.state}>
                  {(communities) => (
                    <select
                      style={field}
                      value={filters.communityId ?? ''}
                      onChange={(e) => set('communityId', e.target.value)}
                    >
                      <option value="">Any</option>
                      {communities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Async>
              </Field>
            )}
            {key && (
              <button
                type="button"
                style={button('quiet')}
                onClick={() => setParams({}, { replace: true })}
              >
                Clear filters
              </button>
            )}
          </form>
        </Panel>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Async state={results.state}>
            {(page) => (
              <>
                <p
                  style={{
                    margin: `0 0 ${spacing.md}px`,
                    color: brand.muted,
                    fontSize: fontSize.sm,
                  }}
                >
                  {page.items.length} {page.items.length === 1 ? 'athlete' : 'athletes'}
                </p>
                {page.items.length === 0 && (
                  <Panel style={{ padding: spacing.lg, color: brand.muted }}>
                    No athletes match these filters.
                  </Panel>
                )}
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: spacing.md,
                  }}
                >
                  {page.items.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/athletes/${a.athleteId}`}
                        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                      >
                        <Panel style={{ padding: spacing.md, display: 'flex', gap: spacing.md }}>
                          <Tile
                            text={a.jerseyNumber ?? '–'}
                            color={a.team?.color ?? brand.navy}
                            size={48}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{ fontWeight: 800, color: brand.navy, fontSize: fontSize.md }}
                            >
                              {a.firstName} {a.lastName}
                            </div>
                            <div style={{ fontSize: fontSize.sm, color: brand.ink, marginTop: 2 }}>
                              {a.team ? `${a.team.college.name} · ${a.team.name}` : 'Alumni'}
                            </div>
                            <div style={{ fontSize: 12, color: brand.muted, marginTop: 6 }}>
                              {[a.major, `Class of ${a.classYear}`, a.position, a.city]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </Panel>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Async>
        </div>
      </div>
    </>
  );
};
