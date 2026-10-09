import { z } from 'zod';
import { CalendarDate, Email, PersonName, Token } from './common';
import { emailDomain, isPersonalEmailDomain } from './companies';
import { ageBand, ageOn, SelfSignupRole } from './roles';

const Password = z.string().min(12, 'Use at least 12 characters');
const AcceptTerms = z.literal(true, { error: 'Agree to the Terms and Privacy Policy to continue' });

export const LoginRequest = z.object({
  email: Email,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/**
 * Open sign-up in the athlete app. Birth date is used only to check age: the minimum is 13 (under
 * 13s exist only as a profile their parent runs), 13–17 year olds sign up as teens, and adults
 * can't pick the teen role.
 */
export const SignupRequest = z
  .object({
    email: Email,
    password: Password,
    firstName: PersonName,
    lastName: PersonName,
    birthDate: CalendarDate,
    role: SelfSignupRole,
    acceptTerms: AcceptTerms,
    /**
     * Teens only: the terms confirm a parent or guardian agreed. No parent link is required for
     * the pilot; if counsel says otherwise, a parent email and one-tap confirmation get added.
     */
    parentAgreed: z.literal(true).optional(),
  })
  .superRefine((signup, ctx) => {
    const band = ageBand(ageOn(signup.birthDate));
    if (band === 'child') {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'Kids under 13 join through a parent or guardian, who runs their profile.',
      });
    } else if (band === 'teen') {
      if (signup.role !== 'teen') {
        ctx.addIssue({ code: 'custom', path: ['role'], message: 'Under 18s join as a teammate.' });
      }
      if (!signup.parentAgreed) {
        ctx.addIssue({
          code: 'custom',
          path: ['parentAgreed'],
          message: 'Confirm a parent or guardian agreed to you joining.',
        });
      }
    } else if (signup.role === 'teen') {
      ctx.addIssue({ code: 'custom', path: ['role'], message: 'The teammate role is for 13–17.' });
    }
  });
export type SignupRequest = z.infer<typeof SignupRequest>;

/**
 * From a coach invite link. A signed-in user sends just the token; a new coach also creates their
 * account. Either way the email comes from the invite.
 */
export const AcceptCoachInviteRequest = z.object({
  token: Token,
  newAccount: z
    .object({
      firstName: PersonName,
      lastName: PersonName,
      password: Password,
      acceptTerms: AcceptTerms,
    })
    .optional(),
});
export type AcceptCoachInviteRequest = z.infer<typeof AcceptCoachInviteRequest>;

/** Recruiter sign-up, on the portal or the app. The work email's domain decides the company. */
export const RecruiterSignupRequest = z.object({
  email: Email.refine(
    (email) => !isPersonalEmailDomain(emailDomain(email)),
    'Personal email addresses can’t be used. Use your work email.',
  ),
  password: Password,
  firstName: PersonName,
  lastName: PersonName,
  title: z.string().trim().max(80).optional(),
  acceptTerms: AcceptTerms,
});
export type RecruiterSignupRequest = z.infer<typeof RecruiterSignupRequest>;
