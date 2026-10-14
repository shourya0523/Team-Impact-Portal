import { useState } from 'react';
import type { Company, List } from '../../shared/data';
import { useWorld } from '../../shared/store';
import { Avatar, Icon, Modal, Pill } from '../../shared/ui';
import { createList, patchList } from '../actions';
import { LIST_COLORS, colleagueName, colleaguesFor, type Account } from '../logic';

export function NewListModal({
  open,
  onClose,
  company,
  withAthlete,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  company: Company;
  withAthlete?: string;
  onCreated: (id: string, name: string) => void;
}) {
  const { update } = useWorld();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]?.[0] ?? '#D0213C');
  const [share, setShare] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const people = colleaguesFor(company.id);
  const err = tried && !name.trim() ? 'Give the list a name.' : '';
  const close = () => {
    setName('');
    setAbout('');
    setShare([]);
    setTried(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="New list">
      <form
        className="stack g14"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!name.trim()) return;
          const id = createList(update, {
            companyId: company.id,
            name: name.trim(),
            color,
            athleteIds: withAthlete ? [withAthlete] : [],
            sharedWith: share,
            note: about.trim() || undefined,
          });
          const n = name.trim();
          setName('');
          setAbout('');
          setShare([]);
          setTried(false);
          onCreated(id, n);
        }}
      >
        <div className="field">
          <label className="label" htmlFor="nl-name">
            List name
          </label>
          <input
            id="nl-name"
            className={'input' + (err ? ' err' : '')}
            placeholder="e.g. Summer 2027 interns"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {err && (
            <div className="err-text" role="alert">
              {err}
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="nl-about">
            What it's for <span className="opt">(optional)</span>
          </label>
          <textarea
            id="nl-about"
            className="textarea"
            placeholder="Role, team or hiring cycle"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            style={{ minHeight: 70 }}
          />
        </div>
        <div className="stack g8" role="group" aria-labelledby="nl-color">
          <div id="nl-color" className="label">
            Color
          </div>
          <div className="row g10">
            {LIST_COLORS.map(([hex, label]) => (
              <button
                key={hex}
                type="button"
                aria-label={label}
                aria-pressed={color === hex}
                onClick={() => setColor(hex)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: hex,
                  cursor: 'pointer',
                  border: '4px solid ' + (color === hex ? '#fff' : hex),
                  boxShadow: '0 0 0 2px ' + (color === hex ? 'var(--ink)' : 'transparent'),
                }}
              />
            ))}
          </div>
        </div>
        <div className="stack g8" role="group" aria-labelledby="nl-share">
          <div id="nl-share" className="label">
            Share with {company.name.split(' ')[0]} colleagues
          </div>
          {people.length ? (
            <div className="row wrap g8">
              {people.map((c) => {
                const on = share.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() =>
                      setShare((s) => (on ? s.filter((x) => x !== c.key) : [...s, c.key]))
                    }
                  >
                    <Icon name={on ? 'check' : 'plus'} size={16} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="tiny">No colleagues have joined yet. You can share the list later.</div>
          )}
          <div className="tiny">
            Only verified @{company.domains[0]} recruiters can be added. Anyone shared can add or
            remove athletes.
          </div>
        </div>
        <div className="row wrap g10 end">
          <button type="button" className="btn btn-quiet" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create list
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ShareListModal({
  open,
  onClose,
  list,
  company,
  account,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  list: List;
  company: Company;
  account: Account;
  toast: (m: string) => void;
}) {
  const { update } = useWorld();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const domain = company.domains[0] ?? '';
  const people = colleaguesFor(company.id);
  const notShared = people.filter((c) => !list.sharedWith.includes(c.key));

  const add = (key: string) => {
    patchList(update, list.id, { sharedWith: [...list.sharedWith, key] });
    toast(`Shared with ${colleagueName(key)}`);
  };
  const submit = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setErr("Enter a colleague's email address.");
    if (!company.domains.some((d) => e.endsWith('@' + d)))
      return setErr(`Only people at ${company.name} (@${domain}) can be added.`);
    if (e === account.email.toLowerCase()) return setErr('That is you. You already own this list.');
    const known = people.find((c) => c.email === e);
    const local = e.split('@')[0] ?? e;
    const first = local.split(/[._-]/)[0] ?? local;
    const key = known?.key ?? first.charAt(0).toUpperCase() + first.slice(1);
    if (list.sharedWith.includes(key)) return setErr(`${colleagueName(key)} already has access.`);
    setErr('');
    setEmail('');
    add(key);
  };
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(
        `${location.origin}${location.pathname}#/portal/lists/${list.id}`,
      );
    } catch {
      /* ignore */
    }
    toast(`Link copied. Only ${company.name} recruiters can open it.`);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Share ${list.name}`}>
      <form
        className="stack g8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="label" htmlFor="sh-email">
          Colleague's email
        </label>
        <div className="row g8">
          <input
            id="sh-email"
            type="email"
            className={'input' + (err ? ' err' : '')}
            placeholder={`name@${domain}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErr('');
            }}
            style={{ minWidth: 0 }}
          />
          <button type="submit" className="btn btn-navy">
            Share
          </button>
        </div>
        {err && (
          <div className="err-text" role="alert">
            {err}
          </div>
        )}
        <div className="tiny">
          Only people at {company.name} (@{domain}) can be added. They see the athletes and every
          note.
        </div>
      </form>
      {notShared.length > 0 && (
        <div className="row wrap g8" aria-label="Suggested colleagues">
          {notShared.map((c) => (
            <button key={c.key} className="chip chip-sm" onClick={() => add(c.key)}>
              <Icon name="plus" size={14} />
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="list">
        <div className="row g12" style={{ padding: '10px 14px' }}>
          <Avatar name={account.name} size={36} />
          <div className="stack grow">
            <div className="strong">{account.name} (you)</div>
            <div className="tiny">{account.email}</div>
          </div>
          <Pill tone="navy">Owner</Pill>
        </div>
        {list.sharedWith.map((k) => {
          const c = people.find((x) => x.key === k);
          return (
            <div key={k} className="row g12" style={{ padding: '10px 14px' }}>
              <Avatar name={colleagueName(k)} color="var(--text-2)" size={36} />
              <div className="stack grow">
                <div className="strong">{colleagueName(k)}</div>
                <div className="tiny">{c?.email ?? `${k.toLowerCase()}@${domain}`}</div>
              </div>
              <span className="tiny">Can edit</span>
              <button
                className="icon-btn"
                aria-label={`Remove ${colleagueName(k)}`}
                onClick={() => {
                  patchList(update, list.id, {
                    sharedWith: list.sharedWith.filter((x) => x !== k),
                  });
                  toast(`${colleagueName(k)} no longer has access`);
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="row wrap g10 between">
        <button className="btn btn-outline" onClick={copy}>
          <Icon name="link" size={18} />
          Copy link
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
