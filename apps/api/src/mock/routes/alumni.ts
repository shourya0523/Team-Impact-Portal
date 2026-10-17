import { z } from 'zod';
import {
  AlumniProfile,
  FindAlumniQuery,
  IdParams,
  UpdateAlumniProfileRequest,
  type SharedContact,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import * as fx from '../fixtures';
import type { MockAlumni } from '../fixtures';
import { blockedBetween } from '../safety';
import { isSuspended } from '../staff-tools';
import type { MockUser, MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * Alumni who help (PRD §8, A7). Athletes, and alumni themselves, browse alumni who turned on
 * mentoring or hiring, with the contacts they share; everyone else is invisible to them. Alumni
 * never browse athletes (no route here lists athletes), and teens, parents, coaches and recruiters
 * get no alumni browse at all. Staff see every alumnus. No health data, and medical community
 * membership isn't part of an alumni profile.
 */
const BROWSE_ROLES = ['athlete', 'alumni_athlete', 'alumni_mentor', 'staff'] as const;
const ALUMNI_ROLES = ['alumni_athlete', 'alumni_mentor'] as const;

const helping = (a: MockAlumni) => a.mentoring || a.hiring;

/** Every channel the alumnus filled in: turning on mentoring or hiring shares them. */
const shared = (a: MockAlumni): SharedContact => ({
  ...(a.contact.email ? { email: a.contact.email } : {}),
  ...(a.contact.phone ? { phone: a.contact.phone } : {}),
  ...(a.contact.linkedinUrl ? { linkedinUrl: a.contact.linkedinUrl } : {}),
});

const profile = (world: MockWorld, a: MockAlumni, contact: SharedContact): AlumniProfile => ({
  user: fx.summaryOf(world.user(a.userId)!),
  college: a.college,
  employer: a.employer,
  mentoring: a.mentoring,
  hiring: a.hiring,
  contact,
});

/** Whether `u` may see alumnus `a` in browse or open their profile. */
const visibleTo = (world: MockWorld, a: MockAlumni, u: MockUser) => {
  const owner = world.user(a.userId);
  if (!owner || (owner.role !== 'alumni_athlete' && owner.role !== 'alumni_mentor')) return false;
  if (u.role === 'staff') return true;
  if (a.userId === u.id) return false;
  return helping(a) && !isSuspended(world, a.userId) && !blockedBetween(world, a.userId, u.id);
};

const contains = (haystack: string | null, needle: string | undefined) =>
  !needle || (haystack ?? '').toLowerCase().includes(needle.toLowerCase());

export const registerAlumniRoutes = (app: ZodApp, world: MockWorld, { requireRole }: Guards) => {
  app.get(
    '/alumni',
    { schema: { querystring: FindAlumniQuery, response: { 200: z.array(AlumniProfile) } } },
    async (request) => {
      const u = requireRole(request, ...BROWSE_ROLES);
      const { college, employer, flag } = request.query;
      return world.alumni
        .filter((a) => visibleTo(world, a, u))
        .filter((a) => contains(a.college, college) && contains(a.employer, employer))
        .filter((a) => !flag || a[flag])
        .map((a) => profile(world, a, helping(a) ? shared(a) : {}));
    },
  );

  app.get(
    '/alumni/:id',
    { schema: { params: IdParams, response: { 200: AlumniProfile } } },
    async (request) => {
      const u = requireRole(request, ...BROWSE_ROLES);
      const a = world.alumni.find((x) => x.userId === request.params.id);
      // Same answer for "no such alumnus" and "not mentoring or hiring", so nothing leaks.
      if (!a || !visibleTo(world, a, u)) throw httpError(404, 'No such alumni profile');
      return profile(world, a, helping(a) ? shared(a) : {});
    },
  );

  /** The alumnus's own details; a fresh account starts with both flags off. */
  const mine = (u: MockUser): MockAlumni =>
    world.alumni.find((a) => a.userId === u.id) ?? {
      userId: u.id,
      college: '',
      employer: null,
      mentoring: false,
      hiring: false,
      contact: { email: u.email, phone: null, linkedinUrl: null },
    };

  app.get('/me/alumni', { schema: { response: { 200: AlumniProfile } } }, async (request) => {
    const u = requireRole(request, ...ALUMNI_ROLES);
    const a = mine(u);
    return profile(world, a, shared(a));
  });

  app.put(
    '/me/alumni',
    { schema: { body: UpdateAlumniProfileRequest, response: { 200: AlumniProfile } } },
    async (request) => {
      const u = requireRole(request, ...ALUMNI_ROLES);
      const next = { ...mine(u) };
      const { college, employer, mentoring, hiring } = request.body;
      if (college !== undefined) next.college = college;
      if (employer !== undefined) next.employer = employer || null;
      if (mentoring !== undefined) next.mentoring = mentoring;
      if (hiring !== undefined) next.hiring = hiring;
      if (helping(next) && !next.college.trim()) {
        throw httpError(400, 'Add the college you attended first');
      }
      const i = world.alumni.findIndex((a) => a.userId === u.id);
      if (i === -1) world.alumni.push(next);
      else world.alumni[i] = next;
      return profile(world, next, shared(next));
    },
  );
};
