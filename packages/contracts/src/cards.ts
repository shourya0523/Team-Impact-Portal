import { z } from 'zod';
import { ClassYear, Id, PersonName, Timestamp } from './common';
import { ContactDetails, ContactSharing, SharedContact } from './contacts';
import { TeamSummary } from './teams';

export const REGIONS = ['northeast', 'midwest', 'south', 'west'] as const;
export const Region = z.enum(REGIONS);
export type Region = z.infer<typeof Region>;

/**
 * What the athlete writes on their Baseball Card, which replaces the resume. Only athletes,
 * current or alumni, have one. No health details, addresses or birthdates.
 */
const cardFieldShape = {
  firstName: PersonName,
  lastName: PersonName,
  /** Text, so "07" stays "07". */
  jerseyNumber: z
    .string()
    .regex(/^\d{1,2}$/, 'Use 0 to 99.')
    .nullable(),
  position: z.string().trim().max(40).nullable(),
  classYear: ClassYear,
  major: z.string().trim().min(1, 'Add your major.').max(80),
  hometown: z.string().trim().max(80).nullable(),
  city: z.string().trim().max(80).nullable(),
  region: Region.nullable(),
  experience: z.string().trim().max(1000).nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  lookingFor: z.string().trim().max(300).nullable(),
};
export const CardFields = z.object(cardFieldShape);
export type CardFields = z.infer<typeof CardFields>;

export const CreateCardRequest = CardFields.partial({
  jerseyNumber: true,
  position: true,
  hometown: true,
  city: true,
  region: true,
  experience: true,
  skills: true,
  lookingFor: true,
});
export type CreateCardRequest = z.infer<typeof CreateCardRequest>;

export const UpdateCardRequest = CardFields.partial();
export type UpdateCardRequest = z.infer<typeof UpdateCardRequest>;

export const CardVisibility = z.object({
  /** The athlete's team and its families see a published card. */
  published: z.boolean(),
  /** Off means the athlete doesn't appear on the employer portal at all. Needs `published`. */
  openToRecruiting: z.boolean(),
  /** Approved parents on the athlete's team. */
  familiesSee: ContactSharing,
  /** Every partner recruiter, while the card is published and open to recruiting. */
  recruitersSee: ContactSharing,
});
export type CardVisibility = z.infer<typeof CardVisibility>;

/** Partial update. The API also rejects recruiting on when the stored card is unpublished. */
export const UpdateCardVisibilityRequest = z
  .object({
    published: z.boolean().optional(),
    openToRecruiting: z.boolean().optional(),
    familiesSee: ContactSharing.partial().optional(),
    recruitersSee: ContactSharing.partial().optional(),
  })
  .refine((v) => !(v.openToRecruiting && v.published === false), {
    path: ['openToRecruiting'],
    message: 'Publish your card first.',
  });
export type UpdateCardVisibilityRequest = z.infer<typeof UpdateCardVisibilityRequest>;

/**
 * The card as anyone allowed to see it sees it: no contact details, no settings. Teens get this
 * shape for their team's athletes, so contact details can't reach them even by mistake.
 */
export const CardFace = z.object({
  id: Id,
  athleteId: Id,
  season: z.number().int(),
  team: TeamSummary.nullable(),
  photoUrl: z.url().nullable(),
  ...cardFieldShape,
});
export type CardFace = z.infer<typeof CardFace>;

/**
 * For approved parents on the athlete's team (the `familiesSee` channels) and partner recruiters
 * (the `recruitersSee` channels). Recruiters only ever get cards that are published and open to
 * recruiting.
 */
export const CardWithContact = CardFace.extend({ contact: SharedContact });
export type CardWithContact = z.infer<typeof CardWithContact>;

/** The athlete's own card, with everything the editor needs. */
export const MyCard = CardFace.extend({
  contact: ContactDetails,
  visibility: CardVisibility,
  /** One card per season; earlier seasons stay visible to the athlete only. */
  isCurrent: z.boolean(),
  updatedAt: Timestamp,
});
export type MyCard = z.infer<typeof MyCard>;

/**
 * Size and page caps for resume upload (PDF or photo). The raw file is deleted after parsing
 * unless the athlete asks to keep it.
 */
export const RESUME_UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxPages: 3,
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'],
} as const;

/**
 * Card fields read from a resume. This is the fixed schema extractor output is validated against.
 * Extracted text is data, never instructions; it lands only here, and nothing from it is shown to
 * anyone until the athlete confirms. If extraction fails the athlete types the fields instead.
 */
export const ResumeDraft = z.object({
  id: Id,
  fields: CardFields.partial(),
  /** Fields the athlete has to open and check before confirming. */
  needsReview: z.array(CardFields.keyof()),
  createdAt: Timestamp,
});
export type ResumeDraft = z.infer<typeof ResumeDraft>;

/** The athlete's checked values. Confirming creates an unpublished card. */
export const ConfirmResumeDraftRequest = CreateCardRequest;
export type ConfirmResumeDraftRequest = z.infer<typeof ConfirmResumeDraftRequest>;
