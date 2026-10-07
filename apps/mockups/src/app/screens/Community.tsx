// Events (list, detail, create) and groups (list, detail, create).
import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Field, Icon, Switch } from '../../shared/ui';
import {
  BackBtn,
  Circle,
  Err,
  EventRow,
  ModalBar,
  Options,
  PostCard,
  Screen,
  Seg,
  Title,
} from '../parts';
import { useVisiblePosts } from '../hooks';
import { useLike } from './Feed';
import {
  addEvent,
  addGroup,
  checkText,
  initials,
  patchAthlete,
  setJoined,
  setRsvp,
  uid,
} from '../model';
import { useApp } from '../state';
import type { EventItem } from '../../shared/data';

function useVisibleEvents(): EventItem[] {
  const { world } = useWorld();
  const { me } = useApp();
  const teamName = world.teams.find((t) => t.id === me.teamId)?.name;
  return world.events.filter((e) => e.scope === 'Everyone' || (!!teamName && e.scope === teamName));
}

/* ---------------- Events ---------------- */
export function Events() {
  const { nav, me } = useApp();
  const events = useVisibleEvents();
  const [tab, setTab] = useState<'team' | 'network' | 'going'>(me.teamId ? 'team' : 'network');
  const shown = events.filter((e) =>
    tab === 'going' ? e.rsvp : tab === 'team' ? e.scope !== 'Everyone' : e.scope === 'Everyone',
  );
  const opts = [
    ...(me.teamId ? [{ id: 'team' as const, label: 'Team' }] : []),
    { id: 'network' as const, label: 'Network' },
    { id: 'going' as const, label: 'Going' },
  ];
  return (
    <Screen tabs style={{ padding: '52px 20px 112px', gap: 12 }}>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <Title>Events</Title>
        {me.persona !== 'teen' && (
          <button
            className="btn btn-sm"
            style={{
              background: 'var(--ink)',
              color: 'var(--ground)',
              borderRadius: 999,
              minHeight: 40,
              padding: '0 14px',
            }}
            onClick={() => nav.go('createEvent')}
          >
            New event
          </button>
        )}
      </div>
      <Seg label="Event filter" value={tab} onChange={setTab} options={opts} />
      {shown.map((e) => (
        <EventRow key={e.id} e={e} onOpen={() => nav.go('event', { id: e.id })} />
      ))}
      {!shown.length && (
        <Empty title={tab === 'going' ? 'No plans yet' : 'No events yet'}>
          {tab === 'going'
            ? 'RSVP to an event and it shows up here.'
            : 'Make one and your team can RSVP.'}
        </Empty>
      )}
    </Screen>
  );
}

export function EventDetail() {
  const { nav, toast } = useApp();
  const { update } = useWorld();
  const e = useVisibleEvents().find((x) => x.id === nav.params.id);
  const [declined, setDeclined] = useState(false);
  if (!e)
    return (
      <Screen>
        <BackBtn label="Events" />
        <Empty title="Event not found" />
      </Screen>
    );
  const team = e.scope !== 'Everyone';
  const faces = ['Coach Rivera', 'Jordan Alvarez', 'Maya Okafor', 'Dana Kim', 'Sofia Park'];
  const cols = ['var(--ink)', '#0F7B5F', 'var(--navy)', '#7A1F2B', 'var(--text-2)'];
  return (
    <div className="screen" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        className="stack g14"
        style={{
          background: team ? 'var(--red)' : 'var(--navy)',
          color: '#fff',
          padding: '52px 20px 22px',
        }}
      >
        <BackBtn label="Events" light />
        <div className="eyebrow" style={{ color: 'var(--on-navy)' }}>
          {e.date.toUpperCase()} · {team ? 'TEAM ONLY' : 'EVERYONE'}
        </div>
        <h1 className="display d-48" style={{ color: '#fff' }}>
          {e.title}
        </h1>
        <div
          className="row g10"
          style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '10px 12px' }}
        >
          <Circle name={e.host} color="var(--ink)" />
          <div className="stack">
            <div style={{ fontSize: 15, fontWeight: 600 }}>{e.host}</div>
            <div style={{ fontSize: 13, color: 'var(--navy-tint)' }}>
              {e.hostRole}
              {team ? ' · ' + e.scope : ''}
            </div>
          </div>
        </div>
      </div>
      <div className="stack g16 grow" style={{ padding: 20 }}>
        <div className="list">
          <div className="row g12" style={{ padding: '14px 16px', fontSize: 15 }}>
            <Icon name="events" />
            {e.date} · {e.time}
          </div>
          <div className="row g12" style={{ padding: '14px 16px', fontSize: 15 }}>
            <Icon name="home" />
            {e.place}
          </div>
        </div>
        <div className="row between">
          <div className="row" style={{ paddingLeft: 8 }}>
            {faces.map((n, i) => (
              <span
                key={n}
                style={{ marginLeft: -8, border: '2px solid var(--ground)', borderRadius: '50%' }}
              >
                <Circle name={n} color={cols[i]} size={32} />
              </span>
            ))}
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>
            {e.going} going
          </span>
        </div>
        <div className="mt-auto grid2" style={{ gap: 10 }}>
          <button
            className={'btn btn-lg ' + (e.rsvp ? 'btn-primary' : '')}
            style={
              e.rsvp ? undefined : { border: '1.5px solid var(--ink)', background: 'transparent' }
            }
            aria-pressed={e.rsvp}
            onClick={() => {
              update(setRsvp(e.id, true));
              setDeclined(false);
              toast('You’re going');
            }}
          >
            {e.rsvp ? 'Going' : 'RSVP going'}
          </button>
          <button
            className={'btn btn-lg ' + (!e.rsvp && declined ? 'btn-primary' : '')}
            style={
              !e.rsvp && declined
                ? undefined
                : { border: '1.5px solid var(--ink)', background: 'transparent' }
            }
            aria-pressed={!e.rsvp && declined}
            onClick={() => {
              update(setRsvp(e.id, false));
              setDeclined(true);
              toast('Marked as can’t make it');
            }}
          >
            Can’t make it
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateEvent() {
  const { me, nav, toast } = useApp();
  const { world, update } = useWorld();
  const teamName = world.teams.find((t) => t.id === me.teamId)?.name;
  const [f, setF] = useState({
    title: nav.params.title ?? '',
    date: 'Sat, Oct 18',
    start: '3:00 PM',
    end: '5:00 PM',
    place: '',
    details: '',
  });
  const [vis, setVis] = useState<'team' | 'network'>(teamName ? 'team' : 'network');
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const errs = {
    title: !f.title.trim() ? 'Give the event a name.' : (checkText(f.title) ?? ''),
    date: !/[A-Za-z]{3}\w*\s+\d{1,2}/.test(f.date) ? 'Use a date like “Sat, Oct 18”.' : '',
    start: !f.start.trim() ? 'Add a start time.' : '',
    place: !f.place.trim() ? 'Where is it?' : '',
    details: f.details ? (checkText(f.details) ?? '') : '',
  };
  const create = () => {
    if (Object.values(errs).some(Boolean)) {
      setTried(true);
      return;
    }
    const id = uid('e');
    update(
      addEvent({
        id,
        title: f.title.trim(),
        date: f.date.trim(),
        time: f.start + (f.end ? ' – ' + f.end : ''),
        place: f.place.trim(),
        host: me.name,
        hostRole: me.roleLabel,
        going: 1,
        rsvp: true,
        scope: vis === 'team' && teamName ? teamName : 'Everyone',
      }),
    );
    toast('Event created. It passed our check.');
    nav.replace('event', { id });
  };
  const E = (k: keyof typeof errs) => (tried ? errs[k] : '');
  return (
    <Screen style={{ gap: 12 }}>
      <ModalBar title="New event" onCancel={nav.back} />
      <Field label="Event name" htmlFor="et" error={E('title')}>
        <input
          id="et"
          className={'input' + (E('title') ? ' err' : '')}
          placeholder="Pumpkin carving with the kids"
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8 }}>
        <Field label="Date" htmlFor="ed">
          <input
            id="ed"
            className={'input' + (E('date') ? ' err' : '')}
            style={{ padding: '0 10px', fontSize: 15 }}
            value={f.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>
        <Field label="Starts" htmlFor="es">
          <input
            id="es"
            className="input"
            style={{ padding: '0 10px', fontSize: 15 }}
            value={f.start}
            onChange={(e) => set('start', e.target.value)}
          />
        </Field>
        <Field label="Ends" htmlFor="ee">
          <input
            id="ee"
            className="input"
            style={{ padding: '0 10px', fontSize: 15 }}
            value={f.end}
            onChange={(e) => set('end', e.target.value)}
          />
        </Field>
      </div>
      <Err>{E('date') || E('start')}</Err>
      <Field label="Place" htmlFor="ep" error={E('place')}>
        <input
          id="ep"
          className={'input' + (E('place') ? ' err' : '')}
          placeholder="Team room, Cousens Gym"
          value={f.place}
          onChange={(e) => set('place', e.target.value)}
        />
      </Field>
      <Field label="Details" optional htmlFor="edesc" error={E('details')}>
        <textarea
          id="edesc"
          className="textarea"
          style={{ minHeight: 70 }}
          placeholder="Bring a pumpkin, we’ll bring the tools and snacks."
          value={f.details}
          onChange={(e) => set('details', e.target.value)}
        />
      </Field>
      <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 6 }}>
          Who can see and RSVP
        </legend>
        <Options
          value={vis}
          onChange={setVis}
          options={[
            { id: 'team', name: 'My team', sub: 'Teammates and families', disabled: !teamName },
            { id: 'network', name: 'Whole network', sub: 'Everyone on Team IMPACT' },
          ]}
        />
      </fieldset>
      <div className="tint">
        Families will see:{' '}
        <b style={{ fontWeight: 600 }}>
          Created by {me.name} · {me.roleLabel}
        </b>
      </div>
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={create}>
        Create event
      </button>
    </Screen>
  );
}

/* ---------------- Groups ---------------- */
const GCOLORS = ['#0F7B5F', '#7A1F2B', 'var(--navy)', 'var(--text-2)', 'var(--ink)'];
const gColor = (id: string) =>
  GCOLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % GCOLORS.length];

export function Groups() {
  const { nav, toast } = useApp();
  const { world, update } = useWorld();
  const [q, setQ] = useState('');
  const match = (n: string) => n.toLowerCase().includes(q.trim().toLowerCase());
  const mine = world.groups.filter((g) => g.joined && match(g.name)),
    other = world.groups.filter((g) => !g.joined && match(g.name));
  return (
    <Screen style={{ gap: 14 }}>
      <BackBtn />
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <Title>Groups</Title>
        <button
          className="btn btn-sm"
          style={{
            background: 'var(--ink)',
            color: 'var(--ground)',
            borderRadius: 999,
            minHeight: 40,
          }}
          onClick={() => nav.go('createGroup')}
        >
          Create group
        </button>
      </div>
      <label htmlFor="gs" className="sr-only">
        Search groups
      </label>
      <input
        id="gs"
        type="search"
        className="input"
        placeholder="Search groups"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="sec">Your groups</div>
      {mine.map((g) => (
        <button key={g.id} className="card-row" onClick={() => nav.go('group', { id: g.id })}>
          <span
            className="tile"
            style={{ width: 44, height: 44, background: gColor(g.id), fontSize: 18 }}
          >
            {initials(g.name)}
          </span>
          <span className="stack grow" style={{ gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{g.name}</span>
            <span className="tiny">{g.members} members</span>
          </span>
          {g.official && <span className="pill pill-navy">OFFICIAL</span>}
        </button>
      ))}
      {!mine.length && (
        <div className="small">
          {q ? 'No joined groups match.' : 'You haven’t joined any groups yet.'}
        </div>
      )}
      <div className="sec" style={{ marginTop: 6 }}>
        Discover
      </div>
      {other.map((g) => (
        <div key={g.id} className="card-row">
          <button
            onClick={() => nav.go('group', { id: g.id })}
            className="row g12 grow"
            style={{
              border: 0,
              background: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              color: 'var(--ink)',
            }}
          >
            <span
              className="tile"
              style={{ width: 44, height: 44, background: gColor(g.id), fontSize: 18 }}
            >
              {initials(g.name)}
            </span>
            <span className="stack grow" style={{ gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{g.name}</span>
              <span className="tiny">
                {g.members} members{g.official ? ' · Official' : ''}
              </span>
            </span>
          </button>
          <button
            className="btn btn-sm"
            style={{
              border: '1.5px solid var(--ink)',
              borderRadius: 999,
              background: 'transparent',
            }}
            onClick={() => {
              update(setJoined(g.id, true));
              toast('Joined ' + g.name);
            }}
          >
            Join
          </button>
        </div>
      ))}
      {!other.length && (
        <div className="small">Nothing else to discover{q ? ' for that search' : ''}.</div>
      )}
    </Screen>
  );
}

export function GroupDetail() {
  const { me, nav, toast, local } = useApp();
  const { world, update } = useWorld();
  const posts = useVisiblePosts();
  const like = useLike();
  const g = world.groups.find((x) => x.id === nav.params.id);
  if (!g)
    return (
      <Screen>
        <BackBtn label="Groups" />
        <Empty title="Group not found" />
      </Screen>
    );
  const maya = world.athletes.find((a) => a.id === 'maya');
  const searchable = !!maya?.groups.includes(g.id);
  const gp = posts.filter((p) => local.groupOf[p.id] === g.id);
  const bg = gColor(g.id);
  return (
    <div className="screen" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        className="stack g10"
        style={{ background: bg, color: '#fff', padding: '52px 20px 20px' }}
      >
        <BackBtn label="Groups" light />
        {g.official && (
          <div className="row g8">
            <span className="pill pill-ok">OFFICIAL</span>
          </div>
        )}
        <h1 className="display d-44" style={{ color: '#fff' }}>
          {g.name}
        </h1>
        <div className="row between g10">
          <div style={{ fontSize: 15, color: '#E6F1EE' }}>
            {g.members} members · made by {g.createdBy.split(' · ')[0]}
          </div>
          <button
            className="btn btn-sm"
            style={{
              border: '1.5px solid #fff',
              borderRadius: 999,
              background: g.joined ? 'transparent' : '#fff',
              color: g.joined ? '#fff' : 'var(--ink)',
            }}
            onClick={() => {
              update(setJoined(g.id, !g.joined));
              if (g.joined && searchable && maya)
                update(patchAthlete('maya', { groups: maya.groups.filter((x) => x !== g.id) }));
              toast(g.joined ? 'Left ' + g.name : 'Joined ' + g.name);
            }}
          >
            {g.joined ? 'Leave' : 'Join'}
          </button>
        </div>
      </div>
      <div className="stack g14" style={{ padding: '18px 20px 28px' }}>
        <p className="body" style={{ fontSize: 15 }}>
          {g.about}
        </p>
        {me.persona === 'athlete' && g.official && g.joined && maya && (
          <div className="panel row g14" style={{ padding: 16 }}>
            <div className="stack g4 grow">
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                Recruiters can find me through this group
              </div>
              <div className="tiny" style={{ color: 'var(--text-2)' }}>
                {maya.published
                  ? 'Separate from being a member. Turn it off any time.'
                  : 'Needs a published card.'}
              </div>
            </div>
            <Switch
              label="Recruiters can find me through this group"
              checked={searchable}
              disabled={!maya.published}
              onChange={(on) => {
                const groups = on ? [...maya.groups, g.id] : maya.groups.filter((x) => x !== g.id);
                update(patchAthlete('maya', { groups, identityOptIn: groups.length > 0 }));
                toast(
                  on ? 'Recruiters can filter by this group' : 'Removed from recruiter filters',
                );
              }}
            />
          </div>
        )}
        <div className="sec">Latest</div>
        {gp.map((p) => (
          <PostCard
            key={p.id}
            p={p}
            liked={like.liked(p.id)}
            onLike={() => like.toggle(p.id)}
            onOpen={() => nav.go('post', { id: p.id })}
            groupName={g.name}
          />
        ))}
        {!gp.length && (
          <Empty title="No posts yet">
            {g.joined ? 'Start the conversation.' : 'Join to post here.'}
          </Empty>
        )}
        {g.joined && (
          <button
            className="btn btn-lg btn-full"
            style={{ background: 'var(--ink)', color: 'var(--ground)' }}
            onClick={() => nav.go('composer', { group: g.id })}
          >
            Post in this group
          </button>
        )}
      </div>
    </div>
  );
}

export function CreateGroup() {
  const { me, nav, toast } = useApp();
  const { world, update } = useWorld();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [tried, setTried] = useState(false);
  const dup = world.groups.some((g) => g.name.toLowerCase() === name.trim().toLowerCase());
  const errs = {
    name: !name.trim()
      ? 'Give the group a name.'
      : dup
        ? 'A group with that name already exists.'
        : (checkText(name) ?? ''),
    about: !about.trim() ? 'Say what the group is for.' : (checkText(about) ?? ''),
  };
  const create = () => {
    if (errs.name || errs.about) {
      setTried(true);
      return;
    }
    const id = uid('g');
    update(
      addGroup({
        id,
        name: name.trim(),
        createdBy: `${me.name} · ${me.roleLabel}`,
        members: 1,
        official: false,
        searchableOptIns: 0,
        joined: true,
        about: about.trim(),
      }),
    );
    toast('Group created');
    nav.replace('group', { id });
  };
  return (
    <Screen style={{ gap: 14 }}>
      <ModalBar title="New group" onCancel={nav.back} />
      <div className="row g14" style={{ alignItems: 'flex-end' }}>
        <span
          className="tile"
          aria-hidden="true"
          style={{ width: 64, height: 64, borderRadius: 16, fontSize: 24 }}
        >
          {name.trim() ? initials(name) : '+'}
        </span>
        <div className="grow">
          <Field label="Group name" htmlFor="gn">
            <input
              id="gn"
              className={'input' + (tried && errs.name ? ' err' : '')}
              placeholder="Athletes in tech"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
      </div>
      {tried && <Err>{errs.name}</Err>}
      <Field label="What it’s for" htmlFor="gd" error={tried ? errs.about : ''}>
        <textarea
          id="gd"
          className="textarea"
          style={{ minHeight: 96 }}
          placeholder="For athletes and alumni heading into software, data and product."
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
      </Field>
      <div className="panel stack g10" style={{ padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>How groups work</div>
        <div className="small" style={{ color: '#2A2E35' }}>
          Anyone on Team IMPACT except recruiters can find and join it. Everything posted is checked
          first.
        </div>
        <div className="small" style={{ color: '#2A2E35' }}>
          Team IMPACT may mark it official. Only official groups can be used by recruiters, and only
          for members who opt in.
        </div>
      </div>
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={create}>
        Create group
      </button>
    </Screen>
  );
}
