import { Link, useSearchParams } from 'react-router';
import { type AthleteSearchQuery, DIVISIONS, REGIONS } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { regionName } from '../../athleteCard';
import { api } from '../../api';
import { useSession } from '../../session';
import { Async, Button, Card, Input, PageHeader, Select, Text, Tile } from '../../ui';
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
  const text = (k: keyof Filters, label: string, placeholder: string) => (
    <Input
      label={label}
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
        <Card style={{ width: 248, flexShrink: 0 }}>
          <form
            // Remount on every change so the text boxes show the URL's values, e.g. after Clear.
            key={key}
            aria-label="Filters"
            onSubmit={(e) => e.preventDefault()}
            style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
          >
            <Select
              label="Region"
              value={filters.region ?? ''}
              onChange={(e) => set('region', e.target.value)}
            >
              <option value="">Any</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {regionName(r)}
                </option>
              ))}
            </Select>
            {text('city', 'City', 'e.g. Boston')}
            {text('sport', 'Sport', 'e.g. Soccer')}
            {text('major', 'Major', 'e.g. Economics')}
            {text('classYear', 'Grad year', 'e.g. 2027')}
            <Select
              label="Division"
              value={filters.division ?? ''}
              onChange={(e) => set('division', e.target.value)}
            >
              <option value="">Any</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  Division {d}
                </option>
              ))}
            </Select>
            {text('experience', 'Experience', 'e.g. internship')}
            {flags?.identitySearch && (
              <Async state={officialCommunities.state}>
                {(communities) => (
                  <Select
                    label="Official community"
                    value={filters.communityId ?? ''}
                    onChange={(e) => set('communityId', e.target.value)}
                  >
                    <option value="">Any</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Async>
            )}
            {key && (
              <Button
                label="Clear filters"
                variant="quiet"
                size="sm"
                onClick={() => setParams({}, { replace: true })}
              />
            )}
          </form>
        </Card>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Async state={results.state}>
            {(page) => (
              <>
                <Text variant="small" color="muted" style={{ marginBottom: spacing.md }}>
                  {page.items.length} {page.items.length === 1 ? 'athlete' : 'athletes'}
                </Text>
                {page.items.length === 0 && (
                  <Card style={{ padding: spacing.lg }}>
                    <Text color="muted">No athletes match these filters.</Text>
                  </Card>
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
                        <Card style={{ flexDirection: 'row', gap: spacing.md }}>
                          <Tile text={a.jerseyNumber ?? '–'} teamColor={a.team?.color} size="md" />
                          <div style={{ minWidth: 0 }}>
                            <Text variant="body" weight="semibold" color="brand">
                              {a.firstName} {a.lastName}
                            </Text>
                            <Text variant="small">
                              {a.team ? `${a.team.college.name} · ${a.team.name}` : 'Alumni'}
                            </Text>
                            <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
                              {[a.major, `Class of ${a.classYear}`, a.position, a.city]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </div>
                        </Card>
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
