import { useState } from 'react';
import { useWorld, type World } from '../../shared/store';
import type { Company } from '../../shared/data';
import { Back, Empty, Field, Icon, Pill } from '../../shared/ui';
import { Box, Confirm, H2, LinkBtn, PageHead, Token } from '../kit';
import { EMAIL_RE, domainError, uid, useStaff, type Person } from '../state';

const StatusPill = ({ c }: { c: Company }) =>
  c.status === 'active' ? (
    <Pill tone="ok">Active</Pill>
  ) : c.status === 'suspended' ? (
    <Pill tone="red">Suspended</Pill>
  ) : (
    <Pill tone="warn">Pending</Pill>
  );

/** Identity searches made by a company's recruiters (matched by company name or a recruiter's name). */
export function searchesFor(w: World, c: Company, roster: Person[]) {
  return w.searchLog.filter(
    (s) =>
      s.who.includes(c.name) ||
      roster.some((p) => s.who.includes(p.name)) ||
      c.domains.some((d) => s.who.includes(d)),
  );
}

/* ---------- Companies list ---------- */

export function Companies() {
  const { world } = useWorld();
  const { nav, local } = useStaff();
  return (
    <>
      <PageHead
        title="Companies"
        action={
          <button className="btn btn-primary" onClick={() => nav.go('addCompany')}>
            <Icon name="plus" size={18} />
            Onboard a company
          </button>
        }
      />
      {world.companies.length === 0 ? (
        <Empty title="No companies yet" />
      ) : (
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Email domains</th>
                <th>Recruiters</th>
                <th>Identity searches (30 days)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {world.companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <LinkBtn onClick={() => nav.go('company', { id: c.id })}>{c.name}</LinkBtn>
                  </td>
                  <td className="small">{c.domains.join(', ')}</td>
                  <td>{c.recruiters}</td>
                  <td>{searchesFor(world, c, local.recruiters[c.id] ?? []).length}</td>
                  <td>
                    <StatusPill c={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="tiny">
        Suspending a company signs out all of its recruiters at once. They see a “paused” screen
        until you restore it.
      </div>
    </>
  );
}

/* ---------- Domain editor shared by onboarding and detail ---------- */

function DomainEditor({
  domains,
  onAdd,
  onRemove,
  taken,
  id,
}: {
  domains: string[];
  onAdd: (d: string) => void;
  onRemove: (d: string) => void;
  taken: string[];
  id: string;
}) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const e = domainError(val, domains, taken);
    setErr(e);
    if (e) return;
    onAdd(val.trim().toLowerCase().replace(/^@/, ''));
    setVal('');
  };
  return (
    <div className="stack g8">
      <div
        className="row g8 wrap"
        style={{
          padding: 8,
          minHeight: 56,
          borderRadius: 12,
          border: '1.5px solid ' + (err ? 'var(--danger)' : 'var(--field-line)'),
          background: 'var(--surface)',
        }}
      >
        {domains.map((d) => (
          <Token key={d} label={'Remove ' + d} onRemove={() => onRemove(d)}>
            {d}
          </Token>
        ))}
        <input
          id={id}
          value={val}
          placeholder="Add a domain"
          aria-invalid={!!err}
          aria-describedby={id + '-help'}
          onChange={(e) => {
            setVal(e.target.value);
            if (err) setErr('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          style={{
            flex: '1 1 160px',
            minWidth: 0,
            height: 40,
            border: 0,
            outline: 'none',
            fontSize: 16,
            background: 'transparent',
          }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={add}>
          Add
        </button>
      </div>
      {err && (
        <div className="err-text" role="alert">
          {err}
        </div>
      )}
      <div id={id + '-help'} className="tiny">
        Anyone who verifies an address on these domains gets recruiter access. Personal email
        providers like gmail.com are blocked.
      </div>
    </div>
  );
}

/* ---------- Onboard a company ---------- */

export function AddCompany() {
  const { world, update } = useWorld();
  const { nav, toast, setLocal } = useStaff();
  const [name, setName] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [first, setFirst] = useState({ name: '', email: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const taken = world.companies.flatMap((c) => c.domains);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = 'Add the company name.';
    else if (world.companies.some((c) => c.name.toLowerCase() === name.trim().toLowerCase()))
      er.name = 'That company is already onboarded.';
    if (domains.length === 0) er.domains = 'Add at least one email domain.';
    const em = first.email.trim().toLowerCase();
    if (!first.name.trim()) er.fname = 'Add the first recruiter’s name.';
    if (!em) er.email = 'Add the first recruiter’s work email.';
    else if (!EMAIL_RE.test(em))
      er.email = 'Check the email. It should look like name@company.com.';
    else if (domains.length && !domains.includes(em.split('@')[1] ?? ''))
      er.email = 'The email has to be on one of the domains above (' + domains.join(', ') + ').';
    setErrs(er);
    if (Object.keys(er).length) return;
    const id = uid('c');
    const co: Company = {
      id,
      name: name.trim(),
      domains,
      recruiters: 1,
      status: 'active',
      since: 'Oct 2026',
    };
    update((w) => ({ ...w, companies: [...w.companies, co] }));
    setLocal((l) => ({
      ...l,
      recruiters: {
        ...l.recruiters,
        [id]: [{ name: first.name.trim(), email: em, joined: 'Invited today' }],
      },
    }));
    toast(co.name + ' is active. Verification email sent to ' + em);
    nav.replace('company', { id, created: '1' });
  };

  return (
    <form className="stack g16" onSubmit={submit} noValidate style={{ maxWidth: 720 }}>
      <Back onClick={nav.back} label="Companies" />
      <PageHead title="Onboard a company" />
      <Field label="Company name" htmlFor="cn" error={errs.name}>
        <input
          id="cn"
          className={'input' + (errs.name ? ' err' : '')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Harbor Health Partners"
        />
      </Field>
      <div className="field">
        <label className="label" htmlFor="dm">
          Email domains
        </label>
        <DomainEditor
          id="dm"
          domains={domains}
          taken={taken}
          onAdd={(d) => {
            setDomains([...domains, d]);
            setErrs((x) => ({ ...x, domains: '' }));
          }}
          onRemove={(d) => setDomains(domains.filter((x) => x !== d))}
        />
        {errs.domains && (
          <div className="err-text" role="alert">
            {errs.domains}
          </div>
        )}
      </div>
      <Box gap={14}>
        <H2>First recruiter</H2>
        <div className="grid2" style={{ gap: 14 }}>
          <Field label="Name" htmlFor="fr-n" error={errs.fname}>
            <input
              id="fr-n"
              className={'input' + (errs.fname ? ' err' : '')}
              value={first.name}
              onChange={(e) => setFirst({ ...first, name: e.target.value })}
              placeholder="Nina Brooks"
            />
          </Field>
          <Field label="Work email" htmlFor="fr-e" error={errs.email}>
            <input
              id="fr-e"
              type="email"
              className={'input' + (errs.email ? ' err' : '')}
              value={first.email}
              onChange={(e) => setFirst({ ...first, email: e.target.value })}
              placeholder={'name@' + (domains[0] ?? 'company.com')}
            />
          </Field>
        </div>
        <div className="small">
          They get a verification link. Colleagues on the same domains can join on their own after
          that.
        </div>
      </Box>
      <div className="row g10 wrap">
        <button type="submit" className="btn btn-primary btn-lg">
          Add company
        </button>
        <button type="button" className="btn btn-quiet btn-lg" onClick={nav.back}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- Company detail ---------- */

export function CompanyDetail() {
  const { world, update } = useWorld();
  const { nav, toast, local, setLocal } = useStaff();
  const c = world.companies.find((x) => x.id === nav.params.id);
  const [confirm, setConfirm] = useState<'suspend' | 'restore' | null>(null);
  const [domainErr, setDomainErr] = useState('');

  if (!c)
    return (
      <>
        <Back onClick={nav.back} label="Companies" />
        <Empty title="Company not found" />
      </>
    );

  const roster = local.recruiters[c.id] ?? [];
  const log = searchesFor(world, c, roster);
  const setCo = (fn: (x: Company) => Company) =>
    update((w) => ({ ...w, companies: w.companies.map((x) => (x.id === c.id ? fn(x) : x)) }));
  const taken = world.companies.filter((x) => x.id !== c.id).flatMap((x) => x.domains);
  const suspended = c.status === 'suspended';

  const apply = () => {
    if (confirm === 'suspend') {
      setCo((x) => ({ ...x, status: 'suspended' }));
      toast(c.name + ' suspended');
    } else {
      setCo((x) => ({ ...x, status: 'active' }));
      toast(c.name + ' restored');
    }
    setConfirm(null);
  };
  const togglePerson = (p: Person) => {
    const off = local.suspendedPeople.includes(p.email);
    setLocal((l) => ({
      ...l,
      suspendedPeople: off
        ? l.suspendedPeople.filter((e) => e !== p.email)
        : [...l.suspendedPeople, p.email],
    }));
    toast(off ? p.name + ' restored' : p.name + ' suspended and signed out');
  };

  return (
    <>
      <Back onClick={nav.back} label="Companies" />
      <PageHead
        eyebrow={c.domains.join(' · ').toUpperCase()}
        title={c.name}
        action={
          !confirm &&
          (suspended || c.status === 'pending' ? (
            <button className="btn btn-outline" onClick={() => setConfirm('restore')}>
              {suspended ? 'Restore company' : 'Activate company'}
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirm('suspend')}>
              Suspend whole company
            </button>
          ))
        }
      />
      {nav.params.created === '1' && c.status === 'active' && roster.length > 0 && (
        <div className="notice-ok" role="status">
          {c.name} is active. {roster[0]?.name} will get a verification email.
        </div>
      )}
      {confirm === 'suspend' && (
        <Confirm
          title={`Suspend ${c.name}?`}
          yes="Yes, suspend"
          onYes={apply}
          onNo={() => setConfirm(null)}
        >
          All {c.recruiters} recruiter{c.recruiters === 1 ? '' : 's'} are signed out right away and
          can’t search, save or message until you restore the company. Their lists and notes are
          kept.
        </Confirm>
      )}
      {confirm === 'restore' && (
        <Confirm
          danger={false}
          title={`${suspended ? 'Restore' : 'Activate'} ${c.name}?`}
          yes={suspended ? 'Yes, restore' : 'Yes, activate'}
          onYes={apply}
          onNo={() => setConfirm(null)}
        >
          Recruiters on {c.domains.join(', ')} can sign in and search again.
        </Confirm>
      )}
      {suspended && (
        <div
          role="status"
          className="notice-warn"
          style={{ background: 'var(--red-tint)', color: '#8A1C2C', fontWeight: 600 }}
        >
          Suspended. All {c.recruiters} recruiters are signed out and can’t search until you restore
          the company.
        </div>
      )}
      {c.status === 'pending' && (
        <div className="notice-warn">Pending. No recruiter has verified an address yet.</div>
      )}

      {roster.length === 0 ? (
        <Empty title="No recruiters yet">
          Recruiters appear here after they verify an email on {c.domains.join(' or ')}.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Recruiter</th>
                <th>Joined</th>
                <th>Identity searches</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const off = local.suspendedPeople.includes(p.email);
                return (
                  <tr key={p.email}>
                    <td>
                      <b style={{ fontWeight: 600 }}>{p.name}</b>{' '}
                      {off && <Pill tone="red">Suspended</Pill>}
                      <div className="tiny">{p.email}</div>
                    </td>
                    <td>{p.joined}</td>
                    <td>{world.searchLog.filter((s) => s.who.includes(p.name)).length}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => togglePerson(p)}
                        disabled={suspended}
                      >
                        {off ? 'Restore' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="row wrap g16" style={{ alignItems: 'stretch' }}>
        <Box style={{ flex: '1 1 340px' }}>
          <H2>Email domains</H2>
          <DomainEditor
            id="cd-dm"
            domains={c.domains}
            taken={taken}
            onAdd={(d) => {
              setCo((x) => ({ ...x, domains: [...x.domains, d] }));
              setDomainErr('');
              toast(d + ' added');
            }}
            onRemove={(d) => {
              if (c.domains.length === 1) {
                setDomainErr(
                  'A company needs at least one domain. Add another before removing ' + d + '.',
                );
                return;
              }
              setCo((x) => ({ ...x, domains: x.domains.filter((y) => y !== d) }));
              setDomainErr('');
              toast(d + ' removed');
            }}
          />
          {domainErr && (
            <div className="err-text" role="alert">
              {domainErr}
            </div>
          )}
        </Box>
        <Box style={{ flex: '1 1 340px' }}>
          <H2>Identity search log</H2>
          {log.length === 0 ? (
            <div className="small">
              No identity searches from this company yet. Every one is logged here with the
              recruiter’s name.
            </div>
          ) : (
            <>
              {[...log].reverse().map((s, i) => (
                <div key={i} style={{ fontSize: 14 }}>
                  {s.when} · {s.who} · {s.query}
                </div>
              ))}
              <button
                className="btn btn-ghost"
                style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                onClick={() => toast('Log exported as CSV')}
              >
                Export full log
              </button>
            </>
          )}
        </Box>
      </div>
    </>
  );
}
