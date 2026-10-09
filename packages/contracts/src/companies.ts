import { z } from 'zod';
import { Id, Timestamp } from './common';
import { UserSummary } from './users';

/** Free-mail providers can't prove someone works at a partner, so they never grant recruiter access. */
export const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
] as const;

export const emailDomain = (email: string): string =>
  email.slice(email.lastIndexOf('@') + 1).toLowerCase();

export const isPersonalEmailDomain = (domain: string): boolean =>
  (PERSONAL_EMAIL_DOMAINS as readonly string[]).includes(domain.toLowerCase());

/** True when `email` is on `domain` or a subdomain of it: `jo@nyc.kestrel.co` is on `kestrel.co`. */
export const emailOnDomain = (email: string, domain: string): boolean => {
  const host = emailDomain(email);
  return host === domain || host.endsWith(`.${domain}`);
};

/** Anyone who verifies an address on one of a company's domains gets recruiter access. */
export const CompanyDomain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, 'Use a domain like northbeam.com')
  .refine((domain) => !isPersonalEmailDomain(domain), 'Personal email domains can’t be used');

const CompanyDomains = z
  .array(CompanyDomain)
  .min(1, 'A company needs at least one domain')
  .max(20)
  .refine((domains) => new Set(domains).size === domains.length, 'List each domain once');

/** Suspending a company signs every recruiter out until it's restored. Lists and notes survive. */
export const COMPANY_STATUSES = ['active', 'suspended'] as const;
export const CompanyStatus = z.enum(COMPANY_STATUSES);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

export const Company = z.object({
  id: Id,
  name: z.string(),
  domains: z.array(z.string()),
  status: CompanyStatus,
  recruiterCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
});
export type Company = z.infer<typeof Company>;

/** Staff onboard a sponsor company with its email domains; its recruiters then sign up themselves. */
export const CreateCompanyRequest = z.object({
  name: z.string().trim().min(1).max(120),
  domains: CompanyDomains,
});
export type CreateCompanyRequest = z.infer<typeof CreateCompanyRequest>;

export const UpdateCompanyRequest = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  domains: CompanyDomains.optional(),
});
export type UpdateCompanyRequest = z.infer<typeof UpdateCompanyRequest>;

/** Staff only. */
export const SetCompanyStatusRequest = z.object({ status: CompanyStatus });
export type SetCompanyStatusRequest = z.infer<typeof SetCompanyStatusRequest>;

/** Anyone who verifies an address on a company domain is admitted. */
export const Recruiter = z.object({
  user: UserSummary,
  email: z.string(),
  title: z.string().nullable(),
  companyId: Id,
  suspended: z.boolean(),
  joinedAt: Timestamp,
});
export type Recruiter = z.infer<typeof Recruiter>;

/** Staff only: suspend or restore one recruiter. */
export const SetRecruiterSuspendedRequest = z.object({ suspended: z.boolean() });
export type SetRecruiterSuspendedRequest = z.infer<typeof SetRecruiterSuspendedRequest>;
