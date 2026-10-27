// Rows for the mock fixtures (`src/mock`), so Postgres starts with the same world the mock serves:
// one Tufts team, two parents with a child each, a teen, Northbeam recruiters, alumni and one
// community of each kind. Ids are the fixtures' own, so tests and screens can point at either.
//
// Fields the schema has no column for yet are noted where they're dropped; the real route layer
// adds them as it needs them.
import { createHash } from 'node:crypto';
import type { PgTable } from 'drizzle-orm/pg-core';
import { COMMENTS } from '../../mock/activity';
import * as fx from '../../mock/fixtures';
import { initialCoachInvites, initialQrCodes, PARENT_PHONES } from '../../mock/team';
import * as schema from '../schema';

type Row<T extends PgTable> = T['$inferInsert'];

// argon2id hash of "team-impact-dev", the shared local password for every seeded account.
export const DEV_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$kwOXDCSVp3jrLCRhtryvcw$3F8TXsfX3cZ6DhEoMEoYr1C1B20F0TTfGItSyp1tal4';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const date = (iso: string) => new Date(iso);

// Mock moderation is the contract's; the database also has `rejected`, which the mock never uses.
const moderation = (status: string) => (status === 'in_review' ? 'pending' : status) as never;

// Birth dates are only collected to check age. Teens are 15, everyone else an adult.
const DOB: Partial<Record<fx.MockUser['role'], string>> = { teen: '2011-05-01' };
const ATHLETE_ROLES = new Set(['athlete', 'alumni_athlete']);
const COLLEGE_OF_ATHLETES = fx.COLLEGES[0]!.id;

const cardOf = (userId: string) => fx.CARDS.find((c) => c.face.athleteId === userId);

/** Builds every fixture row. `now` anchors QR codes and invites, which the mock keeps relative. */
export const fixtureRows = (now = Date.now()) => {
  const qrCodes = initialQrCodes(now);
  const liveCode = qrCodes[0]!;

  const users: Row<typeof schema.users>[] = fx.ALL_USERS.map((u) => {
    const card = cardOf(u.id);
    return {
      id: u.id,
      userType: u.role,
      email: u.email,
      passwordHash: DEV_PASSWORD_HASH,
      firstName: u.firstName,
      lastName: u.lastName,
      dob: DOB[u.role] ?? '1998-03-01',
      emailVerifiedAt: date(u.createdAt),
      createdAt: date(u.createdAt),
      openToRecruiting: card?.visibility.openToRecruiting ?? false,
      collegeId: ATHLETE_ROLES.has(u.role) ? COLLEGE_OF_ATHLETES : null,
      orgId: 'companyId' in u ? u.companyId : null,
      // Recruiter `title` has no column yet.
      jobTitle: 'title' in u ? u.title : null,
      phone: card?.contact.phone ?? PARENT_PHONES[u.id] ?? null,
      linkedinUrl: card?.contact.linkedinUrl ?? null,
      hometown: card?.face.hometown ?? null,
      major: card?.face.major ?? null,
      gradYear: card?.face.classYear ?? null,
    };
  });

  const consentRecords: Row<typeof schema.consentRecords>[] = fx.ALL_USERS.flatMap((u) => [
    {
      userId: u.id,
      flag: 'terms',
      value: true,
      termsVersion: 'v2.0',
      createdAt: date(u.createdAt),
    },
    ...(u.role === 'teen'
      ? [{ userId: u.id, flag: 'parent_agreed', value: true, termsVersion: 'v2.0' }]
      : []),
  ]);

  const orgs: Row<typeof schema.orgs>[] = fx.COMPANIES.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    createdAt: date(c.createdAt),
  }));
  const orgDomains: Row<typeof schema.orgDomains>[] = fx.COMPANIES.flatMap((c) =>
    c.domains.map((domain) => ({ orgId: c.id, domain })),
  );

  const colleges: Row<typeof schema.colleges>[] = fx.COLLEGES.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const teams: Row<typeof schema.teams>[] = fx.TEAMS.map((t) => ({
    id: t.id,
    collegeId: t.college.id,
    sport: t.sport,
    gender: t.gender,
    division: t.division,
    displayName: t.name,
    about: t.about,
    color: t.color,
    status: t.status,
    createdAt: date(t.createdAt),
  }));

  const communities: Row<typeof schema.communities>[] = fx.COMMUNITIES.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    about: c.about,
    teamId: c.kind === 'team' ? c.teamId : null,
    private: c.kind === 'medical' || c.kind === 'interest' ? c.private : false,
    official: c.kind === 'interest' ? c.official : false,
    status: moderation(c.moderation),
    createdBy: c.kind === 'medical' || c.kind === 'interest' ? c.createdById : null,
    createdAt: date(c.createdAt),
  }));

  // Team communities take their members from the team. Team Impact's has everyone but recruiters
  // in the mock without listing them, so it gets no rows here either.
  const teamCommunity = new Map(
    fx.COMMUNITIES.flatMap((c) => (c.kind === 'team' ? [[c.teamId, c.id] as const] : [])),
  );
  const memberships: Row<typeof schema.memberships>[] = [
    ...fx.TEAM_MEMBERS.map((m) => ({
      userId: m.userId,
      communityId: teamCommunity.get(m.teamId)!,
      role: m.userId === fx.USERS.coach.id ? ('coach' as const) : ('member' as const),
      season: '2026-27',
      joinedAt: date(m.joinedAt),
      source: m.joinedVia === 'qr_code' ? ('join_code' as const) : (m.joinedVia as 'coach_invite'),
      joinCodeId: m.joinedVia === 'qr_code' ? liveCode.id : null,
    })),
    ...fx.COMMUNITIES.flatMap((c) =>
      c.members.map((m) => ({
        userId: m.userId,
        communityId: c.id,
        joinedAt: date(m.joinedAt),
        source: 'signup' as const,
        recruiterSearchOptIn: m.recruiterSearchOptIn ?? false,
      })),
    ),
  ];

  const communityJoinRequests: Row<typeof schema.communityJoinRequests>[] = fx.COMMUNITIES.flatMap(
    (c) =>
      c.kind === 'medical' || c.kind === 'interest'
        ? c.requests.map((r) => ({
            userId: r.userId,
            communityId: c.id,
            requestedAt: date(r.requestedAt),
          }))
        : [],
  );

  // The join request's role and class year have no columns yet.
  const joinRequests: Row<typeof schema.joinRequests>[] = fx.JOIN_REQUESTS.map((r) => ({
    id: r.id,
    userId: r.requester.id,
    teamId: r.teamId,
    status: r.status,
    requestedAt: date(r.createdAt),
    decidedAt: r.decidedAt ? date(r.decidedAt) : null,
  }));

  const joinCodes: Row<typeof schema.joinCodes>[] = qrCodes.map((q) => ({
    id: q.id,
    teamId: q.teamId,
    code: q.token,
    shortCode: q.shortCode,
    label: q.label,
    lifetime: q.lifetime,
    createdBy: q.createdById,
    expiresAt: date(q.expiresAt),
    revokedAt: q.revokedAt ? date(q.revokedAt) : null,
    createdAt: date(q.createdAt),
  }));

  const coachInvites: Row<typeof schema.coachInvites>[] = initialCoachInvites(now).map((i) => ({
    id: i.id,
    teamId: i.teamId,
    email: i.email,
    tokenHash: sha256(i.token),
    invitedBy: i.invitedById,
    expiresAt: date(i.expiresAt),
    acceptedAt: i.acceptedAt ? date(i.acceptedAt) : null,
    revokedAt: i.revokedAt ? date(i.revokedAt) : null,
    createdAt: date(i.createdAt),
  }));

  // Child photos are null in the fixtures.
  const children: Row<typeof schema.children>[] = fx.CHILDREN.map((c) => ({
    id: c.id,
    parentUserId: c.parentId,
    teamId: c.teamId,
    firstName: c.firstName,
    age: c.age,
    bio: c.bio,
  }));

  const cards: Row<typeof schema.cards>[] = fx.CARDS.map(({ face, visibility }) => ({
    id: face.id,
    athleteId: face.athleteId,
    season: String(face.season),
    status: visibility.published ? 'published' : 'draft',
    sport: face.teamId ? fx.TEAMS.find((t) => t.id === face.teamId)?.sport : null,
    position: face.position,
    gradYear: face.classYear,
    major: face.major,
    region: face.region,
    city: face.city,
    division: face.teamId ? fx.TEAMS.find((t) => t.id === face.teamId)?.division : null,
    payload: {
      teamId: face.teamId,
      jerseyNumber: face.jerseyNumber,
      hometown: face.hometown,
      experience: face.experience,
      skills: face.skills,
      lookingFor: face.lookingFor,
    },
  }));

  const contactVisibility: Row<typeof schema.contactVisibility>[] = fx.CARDS.flatMap(
    ({ face, visibility }) =>
      (
        [
          ['family', visibility.familiesSee],
          ['recruiter', visibility.recruitersSee],
        ] as const
      ).flatMap(([scope, sees]) =>
        (['email', 'phone', 'linkedin'] as const).map((channel) => ({
          userId: face.athleteId,
          scope,
          channel,
          visible: sees[channel],
        })),
      ),
  );

  // Kind, official badge and opportunity go in the payload until posts get their own columns.
  const posts: Row<typeof schema.posts>[] = fx.POSTS.map((p) => ({
    id: p.id,
    authorId: p.authorId,
    communityId: p.communityId,
    type: p.kind === 'announcement' ? 'announcement' : p.imageUrl ? 'photo' : 'text',
    payload: {
      kind: p.kind,
      text: p.text,
      imageUrl: p.imageUrl ?? null,
      official: p.official,
      ...(p.opportunity ? { opportunity: p.opportunity } : {}),
    },
    status: moderation(p.moderation),
    createdAt: date(p.createdAt),
  }));

  const comments: Row<typeof schema.comments>[] = COMMENTS.map((c) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    body: c.text,
    status: moderation(c.moderation),
    createdAt: date(c.createdAt),
  }));

  // `goingCount` is a fixture number, not real RSVPs, so no rsvps rows.
  const events: Row<typeof schema.events>[] = fx.EVENTS.map((e) => ({
    id: e.id,
    communityId: e.communityId,
    hostId: e.hostId,
    title: e.title,
    details: e.details,
    startsAt: date(e.startsAt),
    endsAt: e.endsAt ? date(e.endsAt) : null,
    location: e.location,
    status: moderation(e.moderation),
    createdAt: date(e.createdAt),
  }));

  // List colour, note and sharing have no columns yet.
  const shortlists: Row<typeof schema.shortlists>[] = fx.LISTS.map((l) => ({
    id: l.id,
    orgId: l.companyId,
    name: l.name,
    createdBy: l.ownerId,
  }));
  const shortlistEntries: Row<typeof schema.shortlistEntries>[] = fx.LISTS.flatMap((l) =>
    l.entries.map((e) => ({
      shortlistId: l.id,
      athleteId: e.athleteId,
      addedBy: e.addedById,
      addedAt: date(e.addedAt),
    })),
  );

  // One report row per report a ticket counts. Profile tickets target the user.
  const reports: Row<typeof schema.reports>[] = fx.TICKETS.flatMap((t) =>
    Array.from({ length: t.reportCount }, (_, i) => ({
      targetType: t.target.kind === 'profile' ? ('user' as const) : t.target.kind,
      targetId: t.target.id,
      reason: t.reasons[i % t.reasons.length] ?? 'other',
      state:
        t.status === 'open'
          ? ('open' as const)
          : t.resolution === 'dismiss'
            ? ('dismissed' as const)
            : ('actioned' as const),
      createdAt: date(t.createdAt),
    })),
  );

  // Insert order follows the foreign keys.
  return [
    [schema.colleges, colleges],
    [schema.orgs, orgs],
    [schema.orgDomains, orgDomains],
    [schema.users, users],
    [schema.consentRecords, consentRecords],
    [schema.teams, teams],
    [schema.coachInvites, coachInvites],
    [schema.communities, communities],
    [schema.joinCodes, joinCodes],
    [schema.memberships, memberships],
    [schema.joinRequests, joinRequests],
    [schema.communityJoinRequests, communityJoinRequests],
    [schema.children, children],
    [schema.contactVisibility, contactVisibility],
    [schema.cards, cards],
    [schema.posts, posts],
    [schema.comments, comments],
    [schema.events, events],
    [schema.shortlists, shortlists],
    [schema.shortlistEntries, shortlistEntries],
    [schema.reports, reports],
  ] as [PgTable, object[]][];
};
