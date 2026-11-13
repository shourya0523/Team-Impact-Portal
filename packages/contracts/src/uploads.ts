import { z } from 'zod';
import { RESUME_UPLOAD_LIMITS } from './cards';
import { Id, Timestamp } from './common';

/** One upload path for every file the platform stores (TI-111). */
export const MEDIA_PURPOSES = ['card_photo', 'child_photo', 'post_image', 'resume'] as const;
export const MediaPurpose = z.enum(MEDIA_PURPOSES);
export type MediaPurpose = z.infer<typeof MediaPurpose>;

const PHOTO_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  // HEIC isn't here: browsers can't show it, so clients convert photos to JPEG before upload.
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

/** Caps per purpose. Resumes keep the limits the card flow already uses. */
export const UPLOAD_LIMITS = {
  card_photo: PHOTO_LIMITS,
  child_photo: PHOTO_LIMITS,
  post_image: PHOTO_LIMITS,
  resume: RESUME_UPLOAD_LIMITS,
} as const satisfies Record<MediaPurpose, { maxBytes: number; mimeTypes: readonly string[] }>;

const file = (purpose: MediaPurpose) => ({
  mimeType: z.enum(UPLOAD_LIMITS[purpose].mimeTypes, 'This file type isn’t allowed.'),
  sizeBytes: z.number().int().positive().max(UPLOAD_LIMITS[purpose].maxBytes, 'File is too large.'),
});

// Uploading a photo means affirming the uploader has the right to share it.
const rightsAffirmed = z.literal(true, 'Confirm you have the right to share this photo.');

export const UploadRequest = z.discriminatedUnion('purpose', [
  z.strictObject({ purpose: z.literal('card_photo'), ...file('card_photo'), rightsAffirmed }),
  z.strictObject({
    purpose: z.literal('child_photo'),
    childId: Id,
    ...file('child_photo'),
    rightsAffirmed,
  }),
  z.strictObject({ purpose: z.literal('post_image'), ...file('post_image'), rightsAffirmed }),
  z.strictObject({ purpose: z.literal('resume'), ...file('resume') }),
]);
export type UploadRequest = z.infer<typeof UploadRequest>;

/** PUT the file to `url` with exactly these headers before `expiresAt`, then call complete. */
export const UploadResponse = z.object({
  mediaId: Id,
  url: z.url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: Timestamp,
});
export type UploadResponse = z.infer<typeof UploadResponse>;
