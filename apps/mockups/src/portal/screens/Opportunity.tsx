import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Icon, Pill } from '../../shared/ui';
import { Blocked } from '../chrome';
import type { PortalProps } from '../ctx';
import { initials, uid } from '../logic';

type Draft = { title: string; details: string; link: string; closes: string; groups: string[] };
const START: Draft = {
  title: 'Summer Analyst Program 2027',
  details:
    'Ten-week paid program in Boston for rising juniors and seniors. Applications close Dec 1.',
  link: 'northbeam.com/careers',
  closes: 'Dec 1, 2026',
  groups: ['firstgen', 'women-fin'],
};

export default function Opportunity(p: PortalProps) {
  const { world, update } = useWorld();
  const [d, setD] = useState<Draft>(START);
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<string[] | null>(null);
  const [onlyOfficial, setOnlyOfficial] = useState(true);

  if (p.suspended)
    return (
      <>
        <h1 className="display d-40">Post an opportunity</h1>
        <Blocked what="Posting" />
      </>
    );

  const groups = world.groups.filter((g) => !onlyOfficial || g.official);
  const chosen = d.groups.filter((id) => groups.some((g) => g.id === id));
  const errs = {
    title: !d.title.trim() ? 'Add a title.' : '',
    details: d.details.trim().length < 10 ? 'Add a few details about the role.' : '',
    link: !/^\S+\.\S+/.test(d.link.trim()) ? 'Add the link where people apply.' : '',
    groups: chosen.length === 0 ? 'Pick at least one group.' : '',
  };
  const valid = Object.values(errs).every((e) => !e);
  const set = (k: keyof Draft, v: string) => setD({ ...d, [k]: v });
  const mine = world.posts.filter((x) => x.author === p.company.name && x.role === 'Recruiter');
  const groupName = (id: string) => world.groups.find((g) => g.id === id)?.name ?? id;

  const submit = () => {
    setTried(true);
    if (!valid) return;
    const text = `${d.title.trim()}. ${d.details.trim()} Apply: ${d.link.trim()}${d.closes.trim() ? ` (closes ${d.closes.trim()})` : ''}. Posted to ${chosen.map(groupName).join(', ')}.`;
    update((w) => ({
      ...w,
      posts: [
        {
          id: uid('p'),
          author: p.company.name,
          role: 'Recruiter',
          time: 'Just now',
          text,
          scope: 'community',
          likes: 0,
          comments: [],
          hidden: true,
        },
        ...w.posts,
      ],
    }));
    setSent(chosen);
    p.toast('Sent to moderation');
  };

  if (sent)
    return (
      <div className="stack g16 screen" style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
        <div
          className="stamp"
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'var(--ok-bg)',
            color: 'var(--ok-fg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={40} />
        </div>
        <h1 className="display d-48">Sent for review</h1>
        <p className="body">
          Your post to {sent.map(groupName).join(' and ')} goes to Team IMPACT moderation first. It
          appears in the {sent.length === 1 ? 'group' : 'groups'} once a moderator checks it,
          usually within a day.
        </p>
        <div className="list">
          {mine.map((x) => (
            <div
              key={x.id}
              className="row g12"
              style={{ padding: '12px 14px', alignItems: 'flex-start' }}
            >
              <div className="stack grow g4">
                <div className="small" style={{ color: 'var(--ink)' }}>
                  {x.text}
                </div>
                <div className="tiny">{x.time}</div>
              </div>
              <Pill tone="warn">In review</Pill>
            </div>
          ))}
        </div>
        <div className="row wrap g10">
          <button
            className="btn btn-primary"
            onClick={() => {
              setSent(null);
              setTried(false);
              setD({ ...START, title: '', details: '' });
            }}
          >
            Post another
          </button>
          <button className="btn btn-quiet" onClick={() => p.reset('search')}>
            Back to search
          </button>
        </div>
      </div>
    );

  return (
    <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
      <form
        className="stack g14"
        style={{ flex: '1 1 400px', maxWidth: 560, minWidth: 0 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h1 className="display d-40">Post an opportunity</h1>
        <div className="field">
          <label className="label" htmlFor="ot">
            Title
          </label>
          <input
            id="ot"
            className={'input' + (tried && errs.title ? ' err' : '')}
            value={d.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={80}
          />
          {tried && errs.title && (
            <div className="err-text" role="alert">
              {errs.title}
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="od">
            Details
          </label>
          <textarea
            id="od"
            className="textarea"
            style={tried && errs.details ? { borderColor: 'var(--danger)' } : undefined}
            value={d.details}
            onChange={(e) => set('details', e.target.value)}
          />
          {tried && errs.details && (
            <div className="err-text" role="alert">
              {errs.details}
            </div>
          )}
        </div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="ol">
              Apply link
            </label>
            <input
              id="ol"
              className={'input' + (tried && errs.link ? ' err' : '')}
              value={d.link}
              onChange={(e) => set('link', e.target.value)}
            />
            {tried && errs.link && (
              <div className="err-text" role="alert">
                {errs.link}
              </div>
            )}
          </div>
          <div className="field">
            <label className="label" htmlFor="oc">
              Closes <span className="opt">(optional)</span>
            </label>
            <input
              id="oc"
              className="input"
              value={d.closes}
              onChange={(e) => set('closes', e.target.value)}
            />
          </div>
        </div>
        <fieldset className="panel stack g6" style={{ padding: 16, margin: 0 }}>
          <legend className="label" style={{ padding: '0 6px' }}>
            Post into these groups
          </legend>
          <label className="check" style={{ alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={onlyOfficial}
              onChange={(e) => setOnlyOfficial(e.target.checked)}
            />
            Only show official groups
          </label>
          {groups.map((g) => {
            const on = d.groups.includes(g.id);
            return (
              <label key={g.id} className="check" style={{ alignItems: 'center', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setD({
                      ...d,
                      groups: on ? d.groups.filter((x) => x !== g.id) : [...d.groups, g.id],
                    })
                  }
                />
                <span>
                  {g.name}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--muted)' }}>
                    · {g.members} members
                  </span>
                </span>
                {g.official && <Pill tone="navy">Official</Pill>}
              </label>
            );
          })}
          {tried && errs.groups && (
            <div className="err-text" role="alert">
              {errs.groups}
            </div>
          )}
        </fieldset>
        <button type="submit" className="btn btn-primary btn-lg">
          Post to {chosen.length || 'a'}{' '}
          {chosen.length === 1 || !chosen.length ? 'group' : 'groups'}
        </button>
      </form>

      <aside
        className="stack g12"
        style={{ flex: '1 1 340px', maxWidth: 460, minWidth: 0 }}
        aria-label="Preview"
      >
        <div
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--muted)' }}
        >
          HOW MEMBERS SEE IT
        </div>
        <div className="panel stack g10" style={{ padding: 18 }}>
          <div className="row g10">
            <span className="avatar" style={{ background: 'var(--ink)' }} aria-hidden="true">
              {initials(p.company.name)}
            </span>
            <div className="stack">
              <div className="strong">{p.company.name}</div>
              <div className="tiny">Sponsor · Opportunity</div>
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{d.title || 'Your title'}</div>
          <div className="small">{d.details || 'Details about the role.'}</div>
          {d.closes && <div className="tiny">Closes {d.closes}</div>}
          <span
            className="btn btn-outline btn-sm"
            style={{ alignSelf: 'flex-start', cursor: 'default' }}
          >
            Apply on {d.link.split('/')[0] || 'your site'}
          </span>
        </div>
        <div className="tint">
          Checked by moderation before it appears. Members can't reply in the app; they apply
          through your link.
        </div>
      </aside>
    </div>
  );
}
