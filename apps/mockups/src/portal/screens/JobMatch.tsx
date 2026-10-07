import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Icon } from '../../shared/ui';
import { Blocked, Jersey } from '../chrome';
import type { PortalProps } from '../ctx';
import { EMPTY, SAMPLE_JD, matchAthletes, termsFromJD, type Match, type Term } from '../logic';

const FIT: Record<Match['fit'], { bg: string; fg: string }> = {
  'Strong match': { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
  'Good match': { bg: 'var(--navy-tint)', fg: 'var(--navy-pressed)' },
  'Some overlap': { bg: 'var(--line-soft)', fg: 'var(--text-2)' },
};

export default function JobMatch(p: PortalProps) {
  const { world } = useWorld();
  const [jd, setJd] = useState(SAMPLE_JD);
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [err, setErr] = useState('');

  if (p.suspended)
    return (
      <>
        <h1 className="display d-40">Search from a job</h1>
        <Blocked what="Job match" />
      </>
    );

  const results = terms ? matchAthletes(world, terms) : [];
  const find = () => {
    if (jd.trim().length < 20) {
      setErr('Paste a job description, at least a sentence or two.');
      return;
    }
    setErr('');
    setTerms(termsFromJD(world, jd));
  };
  const openInSearch = () => {
    if (!terms) return;
    const pick = (k: Term['kind']) => terms.filter((t) => t.kind === k).map((t) => t.value);
    p.setFilters({ ...EMPTY, major: pick('major'), year: pick('year'), city: pick('city') });
    p.reset('search');
  };

  return (
    <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
      <form
        className="stack g12"
        style={{ flex: '1 1 380px', maxWidth: 460, minWidth: 0 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <h1 className="display d-40">Search from a job</h1>
        <label htmlFor="jd" className="label">
          Paste the job description
        </label>
        <textarea
          id="jd"
          className={'textarea' + (err ? ' err' : '')}
          style={{
            minHeight: 260,
            borderRadius: 14,
            fontSize: 15,
            ...(err ? { borderColor: 'var(--danger)' } : {}),
          }}
          value={jd}
          onChange={(e) => {
            setJd(e.target.value);
            setErr('');
          }}
        />
        {err && (
          <div className="err-text" role="alert">
            {err}
          </div>
        )}
        <div className="row g8">
          <button type="submit" className="btn btn-primary btn-lg" style={{ flexGrow: 1 }}>
            Find matches
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-lg"
            onClick={() => {
              setJd('');
              setTerms(null);
            }}
          >
            Clear
          </button>
        </div>
        <div className="tiny">
          We read the text to suggest filters. Nothing about identity is ever taken from a job
          description.
        </div>
      </form>

      <section
        className="stack g14"
        style={{ flex: '999 1 520px', minWidth: 0 }}
        aria-label="Matches"
        aria-live="polite"
      >
        {terms === null ? (
          <Empty title="Matches show up here">
            Paste a job description and select Find matches. We compare it with every card that's
            open to recruiting.
          </Empty>
        ) : (
          <>
            <div className="panel stack g10" style={{ padding: 16 }}>
              <div className="row between wrap g8">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '.1em',
                    color: 'var(--muted)',
                  }}
                >
                  FILTERS FROM THIS JOB · EDIT ANY
                </div>
                {terms.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={openInSearch}>
                    Open in search
                    <Icon name="next" size={16} />
                  </button>
                )}
              </div>
              {terms.length === 0 ? (
                <div className="small">
                  We couldn't pick out a major, class year, city or skill. Try adding a few details.
                </div>
              ) : (
                <div className="row wrap g8">
                  {terms.map((t) => (
                    <span
                      key={t.kind + t.value}
                      className="row g6"
                      style={{
                        minHeight: 36,
                        padding: '0 4px 0 12px',
                        borderRadius: 999,
                        background: 'var(--navy-tint)',
                        color: 'var(--navy-pressed)',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {t.label}
                      <button
                        aria-label={'Remove ' + t.label}
                        onClick={() => setTerms(terms.filter((x) => x !== t))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: 0,
                          background: 'transparent',
                          color: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon name="close" size={14} stroke={3} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.1em',
                color: 'var(--muted)',
              }}
            >
              BEST MATCHES FIRST · {results.length} {results.length === 1 ? 'ATHLETE' : 'ATHLETES'}
            </div>
            {results.length === 0 ? (
              <Empty title="No matches yet">
                No athletes open to recruiting share these terms. Remove a filter or broaden the job
                description.
              </Empty>
            ) : (
              results.map((m) => (
                <button
                  key={m.a.id}
                  onClick={() => p.go('athlete', { id: m.a.id, from: 'jd' })}
                  className="panel row g14"
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--ink)',
                  }}
                >
                  <Jersey num={m.a.num} />
                  <div className="stack grow" style={{ gap: 3 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {m.a.first} {m.a.last}
                    </div>
                    <div className="small">{m.reasons.join(' · ')}</div>
                    <div className="tiny">
                      {m.score} of {terms.length} filters match
                    </div>
                  </div>
                  <span
                    className="pill"
                    style={{ background: FIT[m.fit].bg, color: FIT[m.fit].fg }}
                  >
                    {m.fit}
                  </span>
                </button>
              ))
            )}
          </>
        )}
      </section>
    </div>
  );
}
