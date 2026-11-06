import { describe, expect, it } from 'vitest';
import {
  type Actor,
  can,
  type CardFacts,
  type CommunityFacts,
  contactAudience,
  type ContentFacts,
  membersDenial,
} from './policy';
import type { Role } from './roles';

const actor = (role: Role, teamIds: string[] = [], id: string = role): Actor => ({
  id,
  role,
  teamIds,
  companyId: role === 'recruiter' ? 'acme' : null,
});

const card = (over: Partial<CardFacts> = {}): CardFacts => ({
  athleteId: 'jordan',
  ownerRole: 'athlete',
  teamId: 't1',
  published: true,
  openToRecruiting: true,
  ownerSuspended: false,
  blocked: false,
  ...over,
});

const community = (over: Partial<CommunityFacts>): CommunityFacts => ({
  kind: 'interest',
  official: false,
  private: false,
  moderation: 'approved',
  createdById: 'someone',
  isMember: false,
  medicalEnabled: true,
  ...over,
});

const content = (over: Partial<ContentFacts> = {}): ContentFacts => ({
  authorId: 'jordan',
  blocked: false,
  reportedByActor: false,
  authorSuspended: false,
  ...over,
});

describe('child profiles', () => {
  const child = { parentId: 'parent', teamId: 't1', parentBlocked: false };

  it('are readable by the parent and the team', () => {
    expect(can(actor('parent'), 'child.read', child)).toBe(true);
    expect(can(actor('coach', ['t1']), 'child.read', child)).toBe(true);
    expect(can(actor('athlete', ['t1']), 'child.read', child)).toBe(true);
  });

  it('are hidden from everyone else, recruiters always', () => {
    expect(can(actor('athlete', ['t2']), 'child.read', child)).toBe(false);
    expect(can(actor('staff'), 'child.read', child)).toBe(false);
    expect(can(actor('recruiter', ['t1']), 'child.read', child)).toBe(false);
  });

  it('stay with the family once off a team', () => {
    const solo = { parentId: 'parent', teamId: null, parentBlocked: false };
    expect(can(actor('parent'), 'child.read', solo)).toBe(true);
    expect(can(actor('coach', ['t1']), 'child.read', solo)).toBe(false);
  });
});

describe('teen profiles', () => {
  const teen = { id: 'teen', teamIds: ['t1'], blocked: false };
  const asPerson = { ...teen, role: 'teen' as const, card: null, sharesOpenCommunity: true };

  it('are readable by the teen and their team only', () => {
    expect(can(actor('teen'), 'teen.read', teen)).toBe(true);
    expect(can(actor('athlete', ['t1']), 'teen.read', teen)).toBe(true);
    expect(can(actor('athlete', ['t2']), 'teen.read', teen)).toBe(false);
    expect(can(actor('recruiter', ['t1']), 'teen.read', teen)).toBe(false);
  });

  it('are not opened up by shared communities or alumni rules', () => {
    expect(can(actor('athlete', ['t2']), 'person.read', asPerson)).toBe(false);
  });
});

describe('contacts', () => {
  it('teens never see an athlete’s contacts, even on the same team', () => {
    expect(contactAudience(actor('teen', ['t1']), card())).toBe('none');
    expect(can(actor('teen', ['t1']), 'card.contacts', card())).toBe(false);
  });

  it('approved parents on the team get the family set', () => {
    expect(contactAudience(actor('parent', ['t1']), card())).toBe('families');
    expect(contactAudience(actor('parent', ['t2']), card())).toBe('none');
  });

  it('teammates and staff see the card but no contacts', () => {
    expect(can(actor('athlete', ['t1'], 'sam'), 'card.read', card())).toBe(true);
    expect(contactAudience(actor('athlete', ['t1'], 'sam'), card())).toBe('none');
    expect(contactAudience(actor('staff'), card())).toBe('none');
  });

  it('the owner sees everything', () => {
    expect(contactAudience(actor('athlete', [], 'jordan'), card({ published: false }))).toBe(
      'owner',
    );
  });

  it('family contacts on a roster go to the team’s coaches only', () => {
    expect(can(actor('coach', ['t1']), 'team.familyContacts', { teamId: 't1' })).toBe(true);
    expect(can(actor('coach', ['t2']), 'team.familyContacts', { teamId: 't1' })).toBe(false);
    expect(can(actor('staff'), 'team.familyContacts', { teamId: 't1' })).toBe(false);
    expect(can(actor('parent', ['t1']), 'team.familyContacts', { teamId: 't1' })).toBe(false);
  });
});

describe('recruiters', () => {
  const r = actor('recruiter');

  it('see a card only when published and open to recruiting', () => {
    expect(can(r, 'card.read', card())).toBe(true);
    expect(contactAudience(r, card())).toBe('recruiters');
    expect(can(r, 'card.read', card({ published: false }))).toBe(false);
    expect(can(r, 'card.read', card({ openToRecruiting: false }))).toBe(false);
    expect(can(r, 'card.read', card({ ownerSuspended: true }))).toBe(false);
    expect(can(r, 'card.read', card({ ownerRole: 'teen' }))).toBe(false);
  });

  it('can’t open an athlete’s profile without a visible card', () => {
    const person = {
      id: 'jordan',
      role: 'athlete' as const,
      teamIds: [],
      sharesOpenCommunity: false,
      blocked: false,
    };
    expect(can(r, 'person.read', { ...person, card: card() })).toBe(true);
    expect(can(r, 'person.read', { ...person, card: card({ openToRecruiting: false }) })).toBe(
      false,
    );
    expect(can(r, 'person.read', { ...person, card: null })).toBe(false);
  });

  it('see colleagues but not other companies’ recruiters', () => {
    const other = {
      id: 'x',
      role: 'recruiter' as const,
      teamIds: [],
      card: null,
      sharesOpenCommunity: false,
      blocked: false,
    };
    expect(can(r, 'person.read', { ...other, companyId: 'acme' })).toBe(true);
    expect(can(r, 'person.read', { ...other, companyId: 'globex' })).toBe(false);
  });

  it('read official communities and Team Impact, join nothing, list no members', () => {
    expect(can(r, 'community.read', community({ official: true }))).toBe(true);
    expect(can(r, 'community.read', community({ kind: 'team_impact' }))).toBe(true);
    expect(can(r, 'community.see', community({ official: false }))).toBe(false);
    expect(can(r, 'community.join', { kind: 'interest' })).toBe(false);
    expect(membersDenial(r, community({ official: true }))).toBe('recruiter');
  });
});

describe('communities', () => {
  it('medical: hidden by the switch, never for teens or recruiters, members never listed', () => {
    const med = community({ kind: 'medical', isMember: true });
    expect(can(actor('athlete'), 'community.see', med)).toBe(true);
    expect(can(actor('athlete'), 'community.see', { ...med, medicalEnabled: false })).toBe(false);
    expect(can(actor('teen'), 'community.see', med)).toBe(false);
    expect(can(actor('teen'), 'community.join', { kind: 'medical' })).toBe(false);
    expect(can(actor('recruiter'), 'community.see', med)).toBe(false);
    expect(membersDenial(actor('athlete'), med)).toBe('medical');
  });

  it('private: posts and members for members only', () => {
    const priv = community({ private: true });
    expect(can(actor('athlete'), 'community.read', priv)).toBe(false);
    expect(membersDenial(actor('athlete'), priv)).toBe('private');
    expect(can(actor('athlete'), 'community.members', { ...priv, isMember: true })).toBe(true);
  });

  it('pending ones are seen only by their creator and staff', () => {
    const pending = community({ moderation: 'in_review', createdById: 'athlete' });
    expect(can(actor('athlete'), 'community.see', pending)).toBe(true);
    expect(can(actor('parent'), 'community.see', pending)).toBe(false);
    expect(can(actor('staff'), 'community.see', pending)).toBe(true);
  });

  it('teens are listed only in their team community', () => {
    const teen = { memberId: 'teen', memberRole: 'teen' as const, blocked: false };
    expect(can(actor('athlete'), 'community.listMember', { ...teen, kind: 'team' })).toBe(true);
    expect(can(actor('athlete'), 'community.listMember', { ...teen, kind: 'interest' })).toBe(
      false,
    );
  });
});

describe('teams', () => {
  it('only the team and staff see the roster; coaches and staff manage it', () => {
    expect(can(actor('athlete', ['t1']), 'team.roster', { teamId: 't1' })).toBe(true);
    expect(can(actor('athlete', ['t2']), 'team.roster', { teamId: 't1' })).toBe(false);
    expect(can(actor('staff'), 'team.roster', { teamId: 't1' })).toBe(true);
    expect(can(actor('coach', ['t1']), 'team.manage', { teamId: 't1' })).toBe(true);
    expect(can(actor('athlete', ['t1']), 'team.manage', { teamId: 't1' })).toBe(false);
  });
});

describe('blocks', () => {
  const me = actor('athlete', [], 'me');

  it('blocked users can’t read or reply to each other’s content', () => {
    expect(can(me, 'content.read', content({ blocked: true }))).toBe(false);
    expect(can(me, 'content.reply', content({ blocked: true }))).toBe(false);
    expect(can(me, 'content.read', content())).toBe(true);
  });

  it('official Team Impact content can’t be blocked', () => {
    expect(can(me, 'content.read', content({ blocked: true, official: true }))).toBe(true);
  });

  it('reported or suspended content is hidden', () => {
    expect(can(me, 'content.read', content({ reportedByActor: true }))).toBe(false);
    expect(can(me, 'content.read', content({ authorSuspended: true }))).toBe(false);
  });

  it('blocked members drop out of member lists, but you always see yourself', () => {
    const row = { kind: 'interest' as const, memberRole: 'athlete' as const, blocked: true };
    expect(can(me, 'community.listMember', { ...row, memberId: 'them' })).toBe(false);
    expect(can(me, 'community.listMember', { ...row, memberId: 'me' })).toBe(true);
  });
});
