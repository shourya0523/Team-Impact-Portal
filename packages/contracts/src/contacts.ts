import { z } from 'zod';
import { Email } from './common';

/**
 * No in-app messaging: people reach each other through details the owner chose to share (PRD §6).
 * Athletes pick one set for approved parents on their team and a separate set for recruiters;
 * alumni share theirs with athletes while mentoring or hiring. Teens never see athletes' details.
 */
export const Phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ().-]{7,20}$/, 'Enter a phone number');

export const LinkedInUrl = z
  .string()
  .trim()
  .regex(
    /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]{2,}\/?$/,
    'Use your linkedin.com/in/ profile link',
  );

/** The owner's own details, as they edit them. */
export const ContactDetails = z.object({
  email: Email.nullable(),
  phone: Phone.nullable(),
  linkedinUrl: LinkedInUrl.nullable(),
});
export type ContactDetails = z.infer<typeof ContactDetails>;

export const UpdateContactDetailsRequest = ContactDetails.partial();
export type UpdateContactDetailsRequest = z.infer<typeof UpdateContactDetailsRequest>;

/** Which details one audience gets. */
export const ContactSharing = z.object({
  email: z.boolean(),
  phone: z.boolean(),
  linkedin: z.boolean(),
});
export type ContactSharing = z.infer<typeof ContactSharing>;

/** What a viewer gets: only the channels shared with their audience are present. */
export const SharedContact = z.object({
  email: Email.optional(),
  phone: Phone.optional(),
  linkedinUrl: LinkedInUrl.optional(),
});
export type SharedContact = z.infer<typeof SharedContact>;
