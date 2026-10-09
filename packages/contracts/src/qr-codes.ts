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

export const CreateQrCodeRequest = z.object({ lifetime: QrCodeLifetime });
export type CreateQrCodeRequest = z.infer<typeof CreateQrCodeRequest>;

/** A code as its team's coaches see it. Only they get `token`, since it lets anyone join. */
export const TeamQrCode = z.object({
  id: Id,
  teamId: Id,
  token: Token,
  createdBy: UserSummary,
  lifetime: QrCodeLifetime,
  expiresAt: Timestamp,
  revokedAt: Timestamp.nullable(),
  joinCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
});
export type TeamQrCode = z.infer<typeof TeamQrCode>;

/** Staff see each team's code history, but never a usable token. */
export const TeamQrCodeHistoryEntry = TeamQrCode.omit({ token: true });
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

/** A parent names the children joining with them. */
export const RedeemQrCodeRequest = z.object({
  token: Token,
  childIds: z.array(Id).max(10).optional(),
});
export type RedeemQrCodeRequest = z.infer<typeof RedeemQrCodeRequest>;
