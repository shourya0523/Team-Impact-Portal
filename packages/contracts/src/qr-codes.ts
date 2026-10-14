import { z } from 'zod';
import { Id, Timestamp, Token } from './common';
import { TeamSummary } from './teams';
import { UserSummary } from './users';

/**
 * The fast lane: scanning a live team code joins the team straight away, with no approval. Codes
 * are the only QR codes in the app. They last a week by default and a coach can shorten that, for
 * example to one evening, or revoke a code at any time. Archiving the team kills its codes.
 */
export const QR_CODE_LIFETIMES = ['tonight', 'day', 'week'] as const;
export const QrCodeLifetime = z.enum(QR_CODE_LIFETIMES);
export type QrCodeLifetime = z.infer<typeof QrCodeLifetime>;

/**
 * What a coach types in and reads out: 8 characters with no look-alikes (no 0/O, 1/I/L), shown
 * as two groups of four. It joins like the token does, so only the team's coaches see it.
 */
export const QR_SHORT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const QrShortCode = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/, 'Codes are 8 letters and numbers'));

/** A coach's own note on a code, like "Parents' night". */
export const QrCodeLabel = z.string().trim().min(1).max(60);

export const CreateQrCodeRequest = z.object({
  lifetime: QrCodeLifetime,
  label: QrCodeLabel.optional(),
});
export type CreateQrCodeRequest = z.infer<typeof CreateQrCodeRequest>;

/** A code as its team's coaches see it. Only they get `token`, since it lets anyone join. */
export const TeamQrCode = z.object({
  id: Id,
  teamId: Id,
  token: Token,
  shortCode: z.string(),
  label: z.string().nullable().default(null),
  createdBy: UserSummary,
  lifetime: QrCodeLifetime,
  expiresAt: Timestamp,
  revokedAt: Timestamp.nullable(),
  joinCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
});
export type TeamQrCode = z.infer<typeof TeamQrCode>;

/** Staff see each team's code history, but never a usable token. */
export const TeamQrCodeHistoryEntry = TeamQrCode.omit({ token: true, shortCode: true });
export type TeamQrCodeHistoryEntry = z.infer<typeof TeamQrCodeHistoryEntry>;

/** Who joined through a code. The coach can remove anyone from here. */
export const QrCodeJoin = z.object({
  user: UserSummary,
  joinedAt: Timestamp,
});
export type QrCodeJoin = z.infer<typeof QrCodeJoin>;

/** Shown after a scan, before joining: "Tufts · shared by Coach Rivera · expires Tue". */
export const QrCodePreview = z.object({
  team: TeamSummary,
  sharedBy: UserSummary,
  expiresAt: Timestamp,
});
export type QrCodePreview = z.infer<typeof QrCodePreview>;

export const RedeemQrCodeRequest = z.object({ token: Token });
export type RedeemQrCodeRequest = z.infer<typeof RedeemQrCodeRequest>;
