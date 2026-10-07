// Home feed (all roles), parent home, composer (incl. teen team-only), post detail, report, notifications.
import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Icon, Logo } from '../../shared/ui';
import {
  BackBtn,
  Circle,
  DateBox,
  Err,
  InkChip,
  ModalBar,
  Notice,
  PhoneLayer,
  PhoneSheet,
  PostCard,
  Screen,
  Title,
} from '../parts';
import { useNotifications, useVisiblePosts } from '../hooks';
import {
  addComment,
  addPost,
  addTicket,
  checkText,
  likePost,
  nextTicketId,
  removePost,
  roleColor,
  setRsvp,
  uid,
} from '../model';
import { useApp } from '../state';

const KIDS = ['Leo', 'Mateo'];

export function useLike() {
  const { me, local, setLocal } = useApp();
  const { update } = useWorld();
  const key = (id: string) => me.persona + ':' + id;
  return {
    liked: (id: string) => local.liked.includes(key(id)),
    toggle: (id: string) => {
      const on = local.liked.includes(key(id));
      setLocal((l) => ({
        ...l,
        liked: on ? l.liked.filter((k) => k !== key(id)) : [...l.liked, key(id)],
      }));
      update(likePost(id, on ? -1 : 1));
    },
  };
}

/* ---------------- Home ---------------- */
export function Home() {
  const { me, nav, local } = useApp();
  const { world, update } = useWorld();
  const posts = useVisiblePosts();
  const notes = useNotifications();
  const like = useLike();
  const [f, setF] = useState<'all' | 'team' | 'groups'>('all');
  const parent = me.persona === 'parent';
  const groupName = (pid: string) => world.groups.find((g) => g.id === local.groupOf[pid])?.name;
  const joined = world.groups.filter((g) => g.joined).map((g) => g.id);
  const shown = posts.filter((p) =>
    f === 'all'
      ? true
      : f === 'team'
        ? p.scope === 'team'
        : joined.includes(local.groupOf[p.id] ?? ''),
  );
  const teamName = world.teams.find((t) => t.id === me.teamId)?.name;
  const nextEvent = parent ? world.events.find((e) => e.scope === teamName) : undefined;
  return (
    <Screen tabs style={{ padding: '52px 20px 112px', gap: 12 }}>
      <div className="row between">
        <div className="row g12">
          <Logo size={38} />
          <Title>Home</Title>
        </div>
        <button
          className="icon-btn"
          aria-label={`Notifications${notes.length ? `, ${notes.length} new` : ''}`}
          onClick={() => nav.go('notifications')}
          style={{ position: 'relative', color: 'var(--ink)' }}
        >
          <Icon name="bell" size={24} />
          {notes.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 9,
                right: 10,
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#E8590C',
              }}
            />
          )}
        </button>
      </div>
      <div className="row g8" role="group" aria-label="Filter the feed">
        <InkChip sm on={f === 'all'} onClick={() => setF('all')}>
          All
        </InkChip>
        {me.teamId && (
          <InkChip sm on={f === 'team'} onClick={() => setF('team')}>
            My team
          </InkChip>
        )}
        <InkChip sm on={f === 'groups'} onClick={() => setF('groups')}>
          Groups
        </InkChip>
      </div>
      {nextEvent && (
        <div className="panel row g14" style={{ padding: 14 }}>
          <DateBox date={nextEvent.date} strong />
          <button
            className="stack grow"
            onClick={() => nav.go('event', { id: nextEvent.id })}
            style={{
              border: 0,
              background: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              color: 'var(--ink)',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>{nextEvent.title}</span>
            <span className="tiny">
              By {nextEvent.host} · {nextEvent.hostRole}
            </span>
          </button>
          <button
            className={'btn btn-sm ' + (nextEvent.rsvp ? 'btn-primary' : '')}
            style={
              nextEvent.rsvp
                ? undefined
                : { border: '1.5px solid var(--red)', color: '#B3182F', background: 'transparent' }
            }
            aria-pressed={nextEvent.rsvp}
            onClick={() => update(setRsvp(nextEvent.id, !nextEvent.rsvp))}
          >
            {nextEvent.rsvp ? 'Going' : 'RSVP'}
          </button>
        </div>
      )}
      {f === 'groups' && (
        <button className="card-row" onClick={() => nav.go('groups')}>
          <span className="tile" style={{ width: 44, height: 44, background: '#0F7B5F' }}>
            <Icon name="users" />
          </span>
          <span className="stack grow" style={{ gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Your groups</span>
            <span className="tiny">{joined.length} joined · find more or start one</span>
          </span>
          <Icon name="next" />
        </button>
      )}
      {shown.map((p) => (
        <PostCard
          key={p.id}
          p={p}
          liked={like.liked(p.id)}
          onLike={() => like.toggle(p.id)}
          onOpen={() => nav.go('post', { id: p.id })}
          groupName={groupName(p.id)}
        />
      ))}
      {!shown.length && (
        <Empty title="Nothing here yet">
          {f === 'groups'
            ? 'Posts from groups you join show up here.'
            : 'When your team posts, it shows up here.'}
        </Empty>
      )}
      {!parent && (
        <PhoneLayer>
          <button className="fab" aria-label="New post" onClick={() => nav.go('composer')}>
            <Icon name="plus" size={28} />
          </button>
        </PhoneLayer>
      )}
    </Screen>
  );
}

/* ---------------- Composer ---------------- */
export function Composer() {
  const { me, nav, toast, setLocal } = useApp();
  const { world, update } = useWorld();
  const teen = me.persona === 'teen';
  const team = world.teams.find((t) => t.id === me.teamId);
  const joinedGroups = world.groups.filter((g) => g.joined);
  const pre = nav.params.group;
  const [scope, setScope] = useState<'team' | 'network' | 'group'>(
    pre ? 'group' : me.teamId ? 'team' : 'network',
  );
  const [gid, setGid] = useState(pre ?? joinedGroups[0]?.id ?? '');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(false);
  const [held, setHeld] = useState('');
  const tagsKid = KIDS.some((k) => new RegExp('\\b' + k + '\\b').test(text));
  const eff = teen ? 'team' : tagsKid && me.teamId ? 'team' : scope;
  const post = () => {
    const err = checkText(text);
    if (err) {
      setHeld(err);
      return;
    }
    const id = uid('p');
    update(
      addPost({
        id,
        author: me.name,
        role: me.roleLabel,
        team: eff === 'team' ? me.teamId : undefined,
        time: 'Just now',
        text: text.trim(),
        scope: eff === 'team' ? 'team' : 'community',
        likes: 0,
        comments: [],
      }),
    );
    if (eff === 'group' && gid) setLocal((l) => ({ ...l, groupOf: { ...l.groupOf, [id]: gid } }));
    toast('Posted. It passed our check.');
    nav.back();
  };
  return (
    <Screen style={{ gap: 16 }}>
      <ModalBar
        title="New post"
        onCancel={nav.back}
        action={
          <button
            className="btn btn-primary btn-sm"
            style={{ borderRadius: 999, minHeight: 40, padding: '0 16px' }}
            onClick={post}
          >
            Post
          </button>
        }
      />
      {teen ? (
        <div className="card-row">
          <span
            className="tile"
            style={{ width: 36, height: 36, background: 'var(--navy)', fontSize: 15 }}
          >
            {team?.abbr}
          </span>
          <span className="stack grow">
            <span style={{ fontSize: 15, fontWeight: 600 }}>Posting to {team?.name}</span>
            <span className="tiny">Only your team and families see it</span>
          </span>
          <Icon name="lock" />
        </div>
      ) : (
        <div className="stack g8">
          <div className="label">Who sees this</div>
          <div className="row wrap g8">
            {me.teamId && (
              <InkChip on={eff === 'team'} onClick={() => setScope('team')}>
                My team
              </InkChip>
            )}
            <InkChip on={eff === 'network'} onClick={() => setScope('network')}>
              Whole network
            </InkChip>
            <InkChip on={eff === 'group'} onClick={() => setScope('group')}>
              A group
            </InkChip>
          </div>
          {eff === 'group' &&
            (joinedGroups.length ? (
              <select
                className="select"
                aria-label="Group"
                value={gid}
                onChange={(e) => setGid(e.target.value)}
              >
                {joinedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="small">
                Join a group first.{' '}
                <button className="btn-ghost btn btn-sm" onClick={() => nav.replace('groups')}>
                  Find groups
                </button>
              </div>
            ))}
        </div>
      )}
      <label htmlFor="body" className="sr-only">
        Post text
      </label>
      <textarea
        id="body"
        className="textarea"
        style={{ minHeight: 200, borderRadius: 16, padding: 16, fontSize: 17 }}
        placeholder={teen ? 'Say hi to your team' : 'Share a win, a question or a thank-you'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHeld('');
        }}
      />
      <div className="row g10 wrap">
        <button className="btn btn-quiet" aria-pressed={photo} onClick={() => setPhoto(!photo)}>
          <Icon name={photo ? 'check' : 'camera'} size={18} />
          {photo ? 'Photo added' : 'Photo'}
        </button>
        {!teen && (
          <button
            className="btn btn-quiet"
            onClick={() => nav.replace('createEvent', { title: text.trim().slice(0, 60) })}
          >
            <Icon name="events" size={18} />
            Make it an event
          </button>
        )}
      </div>
      {teen && (
        <p className="small" style={{ margin: 0 }}>
          You can read and comment on posts from the whole Team IMPACT network. Your own posts stay
          with your team.
        </p>
      )}
      {!teen && tagsKid && me.teamId && (
        <Notice icon="lock">
          This tags a child, so it stays with your team. Every post is checked before it appears.
        </Notice>
      )}
      {!teen && !tagsKid && <Notice>Every post is checked before it appears.</Notice>}
      {held && (
        <div className="notice-warn row g12" role="alert" style={{ alignItems: 'flex-start' }}>
          <Icon name="flag" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="stack g4">
            <div style={{ fontWeight: 600 }}>Held for review</div>
            <div>{held}</div>
          </div>
        </div>
      )}
    </Screen>
  );
}

/* ---------------- Post detail ---------------- */
export function PostDetail() {
  const { me, nav, toast, local, setLocal } = useApp();
  const { world, update } = useWorld();
  const visible = useVisiblePosts();
  const like = useLike();
  const p = visible.find((x) => x.id === nav.params.id);
  const [menu, setMenu] = useState(false);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  if (!p)
    return (
      <Screen>
        <BackBtn />
        <Empty title="Post not available">
          It may have been removed, or you blocked or reported it.
        </Empty>
      </Screen>
    );
  const mine = p.author === me.name;
  const teamName = world.teams.find((t) => t.id === p.team)?.name;
  const send = () => {
    const e = checkText(comment);
    if (e) {
      setErr(e);
      return;
    }
    update(addComment(p.id, me.name, comment.trim()));
    setComment('');
    setErr('');
    toast('Comment posted');
  };
  return (
    <Screen style={{ gap: 14 }}>
      <div className="row between">
        <BackBtn label="Back" />
        <button className="icon-btn" aria-label="More options" onClick={() => setMenu(true)}>
          <Icon name="more" size={24} stroke={3} />
        </button>
      </div>
      <div className="row g10">
        {p.official ? (
          <span className="avatar" style={{ background: '#fff', border: '1px solid var(--line)' }}>
            <img src="/logo.png" alt="" style={{ width: 26 }} />
          </span>
        ) : (
          <Circle name={p.author} color={roleColor(p.role)} size={40} />
        )}
        <div className="stack" style={{ gap: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{p.author}</div>
          <div className="tiny">
            {p.role}
            {teamName ? ' · ' + teamName : ''} · {p.time} ·{' '}
            {p.scope === 'team' ? 'Team only' : 'Network'}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 17, lineHeight: 1.45 }}>{p.text}</div>
      {p.id === 'p2' && (
        <div
          style={{
            height: 180,
            borderRadius: 14,
            background: 'var(--photo)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6B6559',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Team photo
        </div>
      )}
      <div className="row g10">
        <button
          className="btn btn-sm btn-quiet"
          aria-pressed={like.liked(p.id)}
          onClick={() => like.toggle(p.id)}
          style={like.liked(p.id) ? { borderColor: 'var(--red)', color: '#B3182F' } : undefined}
        >
          <Icon name="heart" size={16} />
          Rally · {p.likes}
        </button>
      </div>
      <div className="label" style={{ color: 'var(--text-2)' }}>
        {p.comments.length} {p.comments.length === 1 ? 'comment' : 'comments'}
      </div>
      {p.comments
        .filter((c) => !local.blocked.includes(c.author))
        .map((c, i) => (
          <div key={i} className="row g10" style={{ alignItems: 'flex-start' }}>
            <Circle name={c.author} size={32} color="#0F7B5F" />
            <div className="panel stack" style={{ padding: '10px 12px', borderRadius: 14, gap: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.author}</div>
              <div style={{ fontSize: 15, lineHeight: 1.4 }}>{c.text}</div>
            </div>
          </div>
        ))}
      <div className="stack g6" style={{ marginTop: 'auto' }}>
        <label htmlFor="cm" className="label">
          Add a comment
        </label>
        <div className="row g8">
          <input
            id="cm"
            className={'input' + (err ? ' err' : '')}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setErr('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="Say something kind"
          />
          <button className="btn btn-navy" onClick={send}>
            Send
          </button>
        </div>
        <Err>{err}</Err>
        <div className="tiny">Comments are checked before they appear.</div>
      </div>
      <PhoneSheet open={menu} onClose={() => setMenu(false)} label="Post options">
        <div className="stack">
          {mine ? (
            <button
              className="lrow"
              style={{ color: 'var(--danger)' }}
              onClick={() => {
                update(removePost(p.id));
                setMenu(false);
                toast('Post deleted');
                nav.back();
              }}
            >
              <Icon name="trash" />
              Delete my post
            </button>
          ) : (
            <>
              <button
                className="lrow"
                onClick={() => {
                  setMenu(false);
                  nav.go('report', { id: p.id });
                }}
              >
                <Icon name="flag" />
                Report this post
              </button>
              {!p.official && (
                <button
                  className="lrow"
                  onClick={() => {
                    setLocal((l) => ({ ...l, blocked: [...l.blocked, p.author] }));
                    setMenu(false);
                    toast(`Blocked ${p.author}`);
                    nav.back();
                  }}
                >
                  <Icon name="shield" />
                  Block {p.author}
                </button>
              )}
            </>
          )}
          <button
            className="lrow"
            style={{ color: 'var(--text-2)' }}
            onClick={() => setMenu(false)}
          >
            Cancel
          </button>
        </div>
      </PhoneSheet>
    </Screen>
  );
}

/* ---------------- Report ---------------- */
const REASONS = [
  'Bullying or harassment',
  'Inappropriate for kids',
  'Shares private information',
  'Spam or a scam',
  'Something else',
];
export function Report() {
  const { me, nav, setLocal, toast } = useApp();
  const { world, update } = useWorld();
  const p = world.posts.find((x) => x.id === nav.params.id);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(false);
  const [sent, setSent] = useState(false);
  const [blocked, setBlocked] = useState(false);
  if (!p)
    return (
      <Screen>
        <BackBtn />
        <Empty title="Post not available" />
      </Screen>
    );
  const teamName = world.teams.find((t) => t.id === p.team)?.name;
  const send = () => {
    if (!reason) {
      setErr(true);
      return;
    }
    const id = nextTicketId(world);
    update(
      addTicket({
        kind: 'Post',
        reason,
        target: `Post “${p.text.length > 42 ? p.text.slice(0, 42) + '…' : p.text}”`,
        author: `${p.author} · ${p.role}`,
        where: p.scope === 'team' ? `${teamName ?? 'Team'} feed` : 'Community feed',
        reports: [{ by: `${me.name} (${me.roleLabel.toLowerCase()})`, note: note.trim() }],
        status: 'open',
        age: 'Just now',
      }),
    );
    setLocal((l) => ({
      ...l,
      hiddenForMe: [...l.hiddenForMe, p.id],
      reported: [...l.reported, id],
    }));
    setSent(true);
  };
  if (sent) {
    return (
      <Screen>
        <div className="stack g16 grow" style={{ justifyContent: 'center' }}>
          <span
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              background: 'var(--ok-bg)',
              color: '#0B5A45',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check" size={36} />
          </span>
          <Title>Thanks for telling us</Title>
          <p className="body" style={{ color: '#2A2E35' }}>
            Team IMPACT staff will review it. We’ve hidden the post from you while they do. The
            person who posted it won’t know you reported it.
          </p>
          {!p.official && !blocked && (
            <button
              className="btn btn-lg btn-full"
              style={{
                border: '1.5px solid var(--danger)',
                color: 'var(--danger)',
                background: 'transparent',
              }}
              onClick={() => {
                setLocal((l) => ({ ...l, blocked: [...l.blocked, p.author] }));
                setBlocked(true);
                toast(`Blocked ${p.author}`);
              }}
            >
              Also block {p.author}
            </button>
          )}
          {blocked && (
            <Notice tone="ok" icon="check">
              You blocked {p.author}. Undo this any time in Me.
            </Notice>
          )}
          <button className="btn btn-ghost btn-full" onClick={() => nav.reset('home')}>
            Back to Home
          </button>
        </div>
      </Screen>
    );
  }
  return (
    <Screen style={{ gap: 14 }}>
      <BackBtn label="Post" />
      <Title>What’s wrong with it?</Title>
      <fieldset className="list" style={{ margin: 0, padding: 0 }}>
        <legend className="sr-only">Reason</legend>
        {REASONS.map((r) => (
          <label
            key={r}
            className="row g12"
            style={{
              minHeight: 52,
              padding: '0 14px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="reason"
              checked={reason === r}
              onChange={() => {
                setReason(r);
                setErr(false);
              }}
              style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--navy)' }}
            />
            {r}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="rd">
          Anything else? <span className="opt">(optional)</span>
        </label>
        <textarea
          id="rd"
          className="textarea"
          style={{ minHeight: 72 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {err && <Err>Pick a reason first.</Err>}
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={send}>
        Send report
      </button>
    </Screen>
  );
}

/* ---------------- Notifications ---------------- */
export function Notifications() {
  const { nav } = useApp();
  const list = useNotifications();
  const fresh = list.slice(0, 3),
    old = list.slice(3);
  const Row = ({ n, isNew }: { n: (typeof list)[number]; isNew: boolean }) => (
    <button
      className="card-row"
      onClick={() => nav.go(n.go[0], n.go[1] ?? {})}
      style={
        isNew
          ? { alignItems: 'flex-start' }
          : { alignItems: 'flex-start', background: 'transparent', border: 0 }
      }
    >
      <span className="tile" style={{ width: 40, height: 40, borderRadius: 12, background: n.bg }}>
        <Icon name={n.icon} size={20} />
      </span>
      <span className="stack grow" style={{ gap: 2 }}>
        <span style={{ fontSize: 15, lineHeight: 1.35, color: isNew ? 'var(--ink)' : '#2A2E35' }}>
          {n.text}
        </span>
        <span className="tiny">{n.when}</span>
      </span>
      {isNew && (
        <span
          aria-label="New"
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: 'var(--red)',
            flexShrink: 0,
            marginTop: 6,
          }}
        />
      )}
    </button>
  );
  return (
    <Screen style={{ gap: 12 }}>
      <div className="row between">
        <BackBtn label="Home" />
        <button className="btn btn-ghost" onClick={() => nav.go('safety')}>
          Settings
        </button>
      </div>
      <Title>Notifications</Title>
      {!list.length && (
        <Empty title="All quiet">
          Join approvals, replies and events you’re going to show up here.
        </Empty>
      )}
      {fresh.length > 0 && <div className="sec">New</div>}
      {fresh.map((n) => (
        <Row key={n.id} n={n} isNew />
      ))}
      {old.length > 0 && (
        <div className="sec" style={{ marginTop: 4 }}>
          Earlier
        </div>
      )}
      {old.map((n) => (
        <Row key={n.id} n={n} isNew={false} />
      ))}
    </Screen>
  );
}
