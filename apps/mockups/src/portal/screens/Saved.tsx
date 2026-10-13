import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Icon } from '../../shared/ui';
import type { PortalProps } from '../ctx';
import { describeFilters, runSearch, type SavedSearch } from '../logic';

export default function Saved(p: PortalProps) {
  const { world } = useWorld();
  const [confirm, setConfirm] = useState('');
  const setFreq = (id: string, freq: SavedSearch['freq']) => {
    p.setSearches((list) => list.map((s) => (s.id === id ? { ...s, freq } : s)));
    p.toast(freq === 'Off' ? 'Digest turned off' : `${freq} digest on`);
  };

  return (
    <div className="stack g20" style={{ maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      <div className="row wrap g12" style={{ alignItems: 'flex-end' }}>
        <h1 className="display d-48">Saved searches</h1>
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => p.reset('search', { save: '1' })}
        >
          <Icon name="bookmark" size={18} />
          Save current search
        </button>
      </div>
      <p className="body" style={{ fontSize: 15 }}>
        We email you when new athletes match. New cards appear as athletes publish and turn on
        recruiting.
      </p>
      {p.searches.length === 0 ? (
        <Empty
          title="No saved searches"
          action={
            <button className="btn btn-navy" onClick={() => p.reset('search')}>
              Go to search
            </button>
          }
        >
          Set up filters on Search and save them to get a digest when new athletes match.
        </Empty>
      ) : (
        p.searches.map((s) => {
          const now = p.suspended ? null : runSearch(world, s.filters).length;
          return (
            <div key={s.id} className="panel stack g12" style={{ padding: '18px 20px' }}>
              <div className="row wrap g16">
                <div className="stack g6" style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{s.name}</div>
                  <div className="small">{describeFilters(world, s.filters)}</div>
                  {now !== null && (
                    <div className="tiny">
                      {now} {now === 1 ? 'athlete matches' : 'athletes match'} right now
                    </div>
                  )}
                </div>
                <div className="stack" style={{ alignItems: 'center', minWidth: 90 }}>
                  <div className="display" style={{ fontSize: 32, color: 'var(--red)' }}>
                    {s.fresh}
                  </div>
                  <div className="tiny">new this week</div>
                </div>
                <div className="field" style={{ minWidth: 120 }}>
                  <label
                    htmlFor={'dg-' + s.id}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '.08em',
                      color: 'var(--muted)',
                    }}
                  >
                    DIGEST
                  </label>
                  <select
                    id={'dg-' + s.id}
                    className="select"
                    style={{ minHeight: 44 }}
                    value={s.freq}
                    onChange={(e) => setFreq(s.id, e.target.value as SavedSearch['freq'])}
                  >
                    <option>Weekly</option>
                    <option>Daily</option>
                    <option>Off</option>
                  </select>
                </div>
                <div className="row g8">
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      p.setFilters(s.filters);
                      p.reset('search');
                    }}
                  >
                    Open
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => setConfirm(s.id)}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
              {confirm === s.id && (
                <div
                  role="alertdialog"
                  aria-label={`Delete ${s.name}?`}
                  className="row wrap g10"
                  style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--red-tint)' }}
                >
                  <span className="small grow" style={{ color: '#8A1C2C' }}>
                    Delete this saved search and stop its digest?
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ minHeight: 44 }}
                    onClick={() => {
                      p.setSearches((l) => l.filter((x) => x.id !== s.id));
                      setConfirm('');
                      p.toast(`Deleted ${s.name}`);
                    }}
                  >
                    Delete
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    style={{ minHeight: 44 }}
                    onClick={() => setConfirm('')}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
