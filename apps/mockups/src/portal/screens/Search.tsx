import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Icon, Modal, Pill } from '../../shared/ui';
import { companyLists, toggleQuickSave } from '../actions';
import { Blocked, Jersey } from '../chrome';
import type { PortalProps } from '../ctx';
import {
  EMPTY,
  FILTER_KEYS,
  activeGroups,
  cityOf,
  describeFilters,
  filterCount,
  filterOptions,
  officialGroups,
  runSearch,
  sortResults,
  teamFor,
  uid,
  type Filters,
  type SavedSearch,
  type SortKey,
} from '../logic';

const chipStyle = (on: boolean) => ({
  minHeight: 36,
  padding: '0 10px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid ' + (on ? 'var(--navy)' : 'var(--field-line)'),
  background: on ? 'var(--navy)' : '#fff',
  color: on ? '#fff' : 'var(--ink)',
});

export default function Search(p: PortalProps) {
  const { world, update } = useWorld();
  const { filters: f, setFilters } = p;
  const [kw, setKw] = useState(f.keyword);
  const [ex, setEx] = useState(f.expText);
  const [sort, setSort] = useState<SortKey>('newest');
  const [saveOpen, setSaveOpen] = useState(p.params.save === '1');
  const [showFilters, setShowFilters] = useState(true);

  if (p.suspended)
    return (
      <>
        <h1 className="display d-40">Search</h1>
        <Blocked what="Search" />
      </>
    );

  const opts = filterOptions(world);
  const groups = officialGroups(world);
  const idOn = activeGroups(world, f).length > 0;
  const results = sortResults(runSearch(world, f), sort);
  const saved = companyLists(world, p.company.id).find((l) => l.name === 'Saved');

  const toggle = (key: keyof Filters, v: string) => {
    const cur = f[key] as string[];
    setFilters({ ...f, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const clearAll = () => {
    setKw('');
    setEx('');
    setFilters(EMPTY);
  };

  return (
    <>
      <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
        <aside
          aria-label="Filters"
          className="stack g16"
          style={{ flex: '1 1 260px', maxWidth: 320, minWidth: 0 }}
        >
          <div className="row between">
            <h2 className="display" style={{ fontSize: 26 }}>
              Filters
            </h2>
            <div className="row g4">
              {filterCount(f) > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                  Clear all
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((s) => !s)}
              >
                {showFilters ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <form
            className="stack g10"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ ...f, keyword: kw, expText: ex });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="kw">
                Keyword
              </label>
              <input
                id="kw"
                className="input"
                placeholder="Name, skill, school, role"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
              />
            </div>
            {showFilters && (
              <div className="field">
                <label className="label" htmlFor="ex">
                  Experience mentions
                </label>
                <input
                  id="ex"
                  className="input"
                  placeholder="e.g. analyst, SQL, captain"
                  value={ex}
                  onChange={(e) => setEx(e.target.value)}
                />
              </div>
            )}
            <button type="submit" className="btn btn-navy">
              <Icon name="search" size={18} />
              Search
            </button>
          </form>
          {showFilters &&
            FILTER_KEYS.map(([label, key]) => (
              <div key={label} className="stack g6" role="group" aria-label={label}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '.1em',
                    color: 'var(--muted)',
                  }}
                >
                  {label}
                </div>
                <div className="row wrap g6">
                  {opts[label].map((o) => {
                    const on = (f[key] as string[]).includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        style={chipStyle(on)}
                        onClick={() => toggle(key, o)}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          {showFilters && world.identitySearchOn && groups.length > 0 && (
            <div
              className="stack g8"
              style={{
                padding: 14,
                borderRadius: 12,
                background: '#fff',
                border: '1.5px solid var(--field-line)',
              }}
              role="group"
              aria-label="Official affinity group"
            >
              <div className="row between g8">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '.1em',
                    color: 'var(--muted)',
                  }}
                >
                  OFFICIAL AFFINITY GROUP
                </div>
                <Pill tone="warn">LOGGED</Pill>
              </div>
              {groups.map((g) => (
                <label
                  key={g.id}
                  className="check"
                  style={{ alignItems: 'center', fontWeight: 600 }}
                >
                  <input
                    type="checkbox"
                    checked={f.groups.includes(g.id)}
                    onChange={() => toggle('groups', g.id)}
                  />
                  {g.name}
                </label>
              ))}
              <div className="tiny" style={{ color: 'var(--text-2)' }}>
                Only athletes who chose to be found through a group appear. Each search is recorded
                with your name and company.
              </div>
            </div>
          )}
        </aside>

        <section
          className="stack g16"
          style={{ flex: '999 1 560px', minWidth: 0 }}
          aria-label="Results"
        >
          <div className="row wrap g12">
            <h1 className="display d-40" aria-live="polite">
              {results.length} {results.length === 1 ? 'athlete' : 'athletes'}
            </h1>
            {idOn && <Pill tone="warn">Affinity filter on · this search is logged</Pill>}
            <div className="row wrap g8" style={{ marginLeft: 'auto' }}>
              <label htmlFor="sort" className="sr-only">
                Sort
              </label>
              <select
                id="sort"
                className="select"
                style={{ minHeight: 44, width: 'auto' }}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="newest">Newest cards</option>
                <option value="year">Grad year</option>
                <option value="name">Last name</option>
              </select>
              <button className="btn btn-outline" onClick={() => setSaveOpen(true)}>
                <Icon name="bookmark" size={18} />
                Save search
              </button>
              <button
                className="btn btn-quiet"
                onClick={() =>
                  p.toast('Open the Team IMPACT app on your phone to swipe through these cards.')
                }
              >
                Quick review on phone
              </button>
            </div>
          </div>
          <div className="tiny">
            {describeFilters(world, f)}. Only athletes who published a card and turned on open to
            recruiting are shown.
          </div>

          {results.length === 0 ? (
            <Empty
              title="No athletes match"
              action={
                <button className="btn btn-navy" onClick={clearAll}>
                  Clear filters
                </button>
              }
            >
              Try removing a filter or two. New cards show up as athletes publish and turn on
              recruiting.
            </Empty>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
                gap: 14,
              }}
            >
              {results.map((a) => {
                const t = teamFor(world, a);
                const isSaved = !!saved?.athleteIds.includes(a.id);
                return (
                  <div
                    key={a.id}
                    className="panel"
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  >
                    <button
                      onClick={() => p.go('athlete', { id: a.id, from: 'search' })}
                      className="row g12"
                      style={{
                        alignItems: 'flex-start',
                        padding: 12,
                        border: 0,
                        borderTop: '6px solid ' + t.color,
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        flexGrow: 1,
                      }}
                      aria-label={`Open ${a.first} ${a.last}'s card`}
                    >
                      <Jersey num={a.num} w={56} h={70} font={22} />
                      <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>
                          {a.first} {a.last}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                          {t.name} · {a.position}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                          {t.college.replace(' University', '')} · D-{a.division}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {a.major} · {a.year}
                        </div>
                      </div>
                    </button>
                    <div
                      className="row between"
                      style={{
                        padding: '6px 12px',
                        borderTop: '1px solid var(--line-soft)',
                        background: '#FBFAF7',
                      }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {cityOf(a)}
                        {a.city.includes(',') ? ',' + a.city.split(',')[1] : ''}
                      </div>
                      <button
                        className={'btn btn-sm ' + (isSaved ? 'btn-quiet' : 'btn-primary')}
                        aria-pressed={isSaved}
                        aria-label={
                          (isSaved ? 'Remove from Saved: ' : 'Save ') + a.first + ' ' + a.last
                        }
                        onClick={() => {
                          const now = toggleQuickSave(world, update, p.company.id, a.id);
                          p.toast(
                            now ? `Saved ${a.first} to Saved` : `Removed ${a.first} from Saved`,
                          );
                        }}
                      >
                        {isSaved ? (
                          <>
                            <Icon name="check" size={16} />
                            Saved
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <SaveSearchModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        summary={describeFilters(world, f)}
        onSave={(name, freq) => {
          const s: SavedSearch = { id: uid('s'), name, filters: f, freq, fresh: 0 };
          p.setSearches((list) => [s, ...list]);
          setSaveOpen(false);
          p.toast(`Saved "${name}". ${freq === 'Off' ? 'No digest.' : freq + ' digest on.'}`);
        }}
        onView={() => {
          setSaveOpen(false);
          p.reset('saved');
        }}
      />
    </>
  );
}

function SaveSearchModal({
  open,
  onClose,
  onSave,
  onView,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, freq: SavedSearch['freq']) => void;
  onView: () => void;
  summary: string;
}) {
  const [name, setName] = useState('');
  const [freq, setFreq] = useState<SavedSearch['freq']>('Weekly');
  const [tried, setTried] = useState(false);
  const err = tried && !name.trim() ? 'Give the search a name.' : '';
  return (
    <Modal open={open} onClose={onClose} title="Save this search">
      <form
        className="stack g16"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (name.trim()) {
            onSave(name.trim(), freq);
            setName('');
            setTried(false);
          }
        }}
      >
        <div className="tint">{summary}</div>
        <div className="field">
          <label className="label" htmlFor="ss-name">
            Name
          </label>
          <input
            id="ss-name"
            className={'input' + (err ? ' err' : '')}
            placeholder="e.g. Finance interns, Boston"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
          {err && (
            <div className="err-text" role="alert">
              {err}
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="ss-freq">
            Email digest
          </label>
          <select
            id="ss-freq"
            className="select"
            value={freq}
            onChange={(e) => setFreq(e.target.value as SavedSearch['freq'])}
          >
            <option>Weekly</option>
            <option>Daily</option>
            <option>Off</option>
          </select>
          <div className="tiny">We email you when new athletes match.</div>
        </div>
        <div className="row wrap g10 end">
          <button type="button" className="btn btn-ghost" onClick={onView}>
            See saved searches
          </button>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save search
          </button>
        </div>
      </form>
    </Modal>
  );
}
