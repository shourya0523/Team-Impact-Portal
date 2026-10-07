import { useState } from 'react';
import { useWorld } from '../../shared/store';
import type { Alumni as AlumniRow } from '../../shared/data';
import { Empty, Field, Icon, Modal, Pill } from '../../shared/ui';
import { PageHead } from '../kit';
import { uid, useStaff } from '../state';

const InvitePill = ({ s }: { s: AlumniRow['invite'] }) =>
  s === 'claimed' ? (
    <Pill tone="ok">Claimed</Pill>
  ) : s === 'sent' ? (
    <Pill tone="warn">Invite sent</Pill>
  ) : (
    <Pill tone="gray">Not sent</Pill>
  );

const LINKEDIN_RE = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]{2,}\/?$/;
const empty = { name: '', school: '', sport: '', year: '', work: '', city: '', linkedin: '' };

export function Alumni() {
  const { world, update } = useWorld();
  const { toast } = useStaff();
  const [building, setBuilding] = useState(false);
  const [view, setView] = useState<AlumniRow | null>(null);
  const [f, setF] = useState(empty);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const setInvite = (id: string, invite: AlumniRow['invite']) =>
    update((w) => ({ ...w, alumni: w.alumni.map((a) => (a.id === id ? { ...a, invite } : a)) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Add their name.';
    if (!f.school.trim()) er.school = 'Add the college.';
    if (!f.sport.trim()) er.sport = 'Add the sport.';
    const y = Number(f.year);
    if (!/^\d{4}$/.test(f.year) || y < 1950 || y > 2026)
      er.year = 'Use a four-digit year between 1950 and 2026.';
    if (!f.work.trim()) er.work = 'Add what they do now.';
    if (!f.linkedin.trim()) er.linkedin = 'Add their LinkedIn profile link.';
    else if (!LINKEDIN_RE.test(f.linkedin.trim()))
      er.linkedin = 'Use a profile link like linkedin.com/in/name.';
    setErrs(er);
    if (Object.keys(er).length) return;
    const row: AlumniRow = {
      id: uid('a'),
      name: f.name.trim(),
      school: `${f.school.trim()} ’${f.year.slice(2)}`,
      sport: f.sport.trim(),
      year: f.year,
      work: f.work.trim(),
      city: f.city.trim(),
      mentoring: false,
      hiring: false,
      source: 'LinkedIn profile',
      invite: 'not sent',
    };
    update((w) => ({ ...w, alumni: [row, ...w.alumni] }));
    toast(`Card built for ${row.name}. Send the invite when ready.`);
    setF(empty);
    setBuilding(false);
  };
  const inp = (k: keyof typeof empty, label: string, ph: string, opt = false) => (
    <Field label={label} htmlFor={'al-' + k} error={errs[k]} optional={opt}>
      <input
        id={'al-' + k}
        className={'input' + (errs[k] ? ' err' : '')}
        value={f[k]}
        placeholder={ph}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </Field>
  );

  return (
    <>
      <PageHead
        title="Alumni cards"
        action={
          <button className="btn btn-primary" onClick={() => setBuilding(true)}>
            <Icon name="plus" size={18} />
            Build a card
          </button>
        }
      />
      <div className="tint">
        Cards stay invisible until the alumnus claims them from their personal link. Only the link
        holder can claim.
      </div>
      {world.alumni.length === 0 ? (
        <Empty
          title="No alumni cards yet"
          action={
            <button className="btn btn-outline" onClick={() => setBuilding(true)}>
              Build a card
            </button>
          }
        >
          Build one from a public LinkedIn profile, then send the claim link.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Alumnus</th>
                <th>College · Sport</th>
                <th>Built from</th>
                <th>Invite</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {world.alumni.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="tiny">{a.work}</div>
                  </td>
                  <td>
                    {a.school} · {a.sport}
                  </td>
                  <td className="small">{a.source}</td>
                  <td>
                    <InvitePill s={a.invite} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {a.invite === 'not sent' && (
                      <button
                        className="btn btn-navy btn-sm"
                        onClick={() => {
                          setInvite(a.id, 'sent');
                          toast('Claim link sent to ' + a.name);
                        }}
                      >
                        Send invite
                      </button>
                    )}
                    {a.invite === 'sent' && (
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => toast('Claim link copied')}
                      >
                        Copy link
                      </button>
                    )}
                    {a.invite === 'claimed' && (
                      <button className="btn btn-outline btn-sm" onClick={() => setView(a)}>
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={building}
        onClose={() => {
          setBuilding(false);
          setErrs({});
        }}
        title="Build a card"
      >
        <form className="stack g12" onSubmit={submit} noValidate>
          <div className="small">
            Fill this in from their public profile. Nothing is shown to anyone until they claim it.
          </div>
          {inp('name', 'Name', 'Marcus Hill')}
          <div className="grid2" style={{ gap: 12 }}>
            {inp('school', 'College', 'Northeastern')}
            {inp('year', 'Graduation year', '2015')}
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            {inp('sport', 'Sport', 'Track')}
            {inp('city', 'City', 'Boston, MA', true)}
          </div>
          {inp('work', 'Current work', 'Physical therapist')}
          {inp('linkedin', 'LinkedIn URL', 'linkedin.com/in/name')}
          <div className="row g8 wrap">
            <button type="submit" className="btn btn-primary">
              Build card
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setBuilding(false);
                setErrs({});
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.name ?? ''}>
        {view && (
          <div className="stack g10">
            <div className="row g8 wrap">
              <InvitePill s={view.invite} />
              {view.mentoring && <Pill>Open to mentoring</Pill>}
              {view.hiring && <Pill tone="ok">Hiring</Pill>}
            </div>
            <div className="list">
              {[
                ['College', view.school],
                ['Sport', view.sport],
                ['Now', view.work],
                ['City', view.city || '—'],
                ['Built from', view.source],
              ].map(([k, v]) => (
                <div key={k} className="row between g12" style={{ padding: '10px 14px' }}>
                  <span className="tiny">{k}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="small">
              Claimed cards are run by the alumnus. Staff can only see them.
            </div>
            <button className="btn btn-quiet" onClick={() => setView(null)}>
              Close
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
