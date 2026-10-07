import { useWorld } from '../shared/store';
import type { Post } from '../shared/data';
import { useApp } from './state';
import type { Screen } from './model';

/** Posts this user is allowed to see right now (team scope, hidden, blocked, reported). */
export function useVisiblePosts(): Post[] {
  const { world } = useWorld();
  const { me, local } = useApp();
  return world.posts.filter(
    (p) =>
      !p.hidden &&
      !local.blocked.includes(p.author) &&
      !local.hiddenForMe.includes(p.id) &&
      (p.scope === 'community' || (!!me.teamId && p.team === me.teamId)),
  );
}

export type Notif = {
  id: string;
  icon: string;
  bg: string;
  text: string;
  when: string;
  go: [Screen, Record<string, string>?];
};

/** Recent items relevant to the current persona, newest first. */
export function useNotifications(): Notif[] {
  const { world } = useWorld();
  const { me, local } = useApp();
  const posts = useVisiblePosts();
  const out: Notif[] = [];
  if (me.persona === 'coach' && local.prefs.approvals) {
    const pend = world.joinRequests.filter((r) => r.teamId === me.teamId && r.status === 'pending');
    if (pend.length)
      out.push({
        id: 'req',
        icon: 'users',
        bg: 'var(--red)',
        text: `${pend.length} ${pend.length === 1 ? 'person is' : 'people are'} waiting to join your team.`,
        when: 'Now',
        go: ['coachTeam'],
      });
  }
  if (me.fresh && me.teamId && local.prefs.approvals)
    out.push({
      id: 'signed',
      icon: 'check',
      bg: 'var(--red)',
      text: 'You’re signed! You’re on Women’s Soccer.',
      when: '2 min ago',
      go: ['roster'],
    });
  for (const id of local.reported) {
    const t = world.tickets.find((x) => x.id === id);
    if (t)
      out.push({
        id: 'tk' + id,
        icon: 'shield',
        bg: 'var(--navy)',
        text:
          t.status === 'open'
            ? 'We got your report. Team IMPACT staff will review it.'
            : 'Team IMPACT reviewed your report and took action. Thanks for flagging it.',
        when: t.status === 'open' ? 'Just now' : 'Today',
        go: ['home'],
      });
  }
  if (local.prefs.replies) {
    for (const p of posts.filter((x) => x.author === me.name)) {
      const last = [...p.comments].reverse().find((c) => c.author !== me.name);
      if (last)
        out.push({
          id: 'c' + p.id,
          icon: 'comment',
          bg: 'var(--navy)',
          text: `${last.author} replied to your post: “${last.text}”`,
          when: '1h',
          go: ['post', { id: p.id }],
        });
    }
  }
  if (local.prefs.events && me.persona !== 'recruiter') {
    for (const e of world.events
      .filter((x) => x.rsvp && (x.scope === 'Everyone' || !!me.teamId))
      .slice(0, 2)) {
      out.push({
        id: 'e' + e.id,
        icon: 'events',
        bg: '#0F7B5F',
        text: `${e.title} is ${e.date} at ${e.time}. You’re going.`,
        when: '3h',
        go: ['event', { id: e.id }],
      });
    }
  }
  for (const p of posts.filter((x) => x.official).slice(0, 2))
    out.push({
      id: 'o' + p.id,
      icon: 'megaphone',
      bg: 'var(--ink)',
      text: 'Team IMPACT: ' + p.text,
      when: 'Yesterday',
      go: ['post', { id: p.id }],
    });
  return out;
}
