import { z } from 'zod';

/** Every row id is a Postgres uuid. */
export const Id = z.uuid();

/** Instants travel as ISO 8601 strings (what `Date#toISOString()` produces). */
export const Timestamp = z.iso.datetime({ offset: true });

/** A calendar date with no time or zone, e.g. `2026-10-19`. */
export const CalendarDate = z.iso.date();

/** Emails are compared and stored lowercased. */
export const Email = z.email().transform((value) => value.toLowerCase());

export const PersonName = z.string().trim().min(1).max(80);

/** Opaque, unguessable value in an invite link or QR code. */
export const Token = z.string().min(16).max(256);

/** Graduating class, e.g. 2028 for "Class of 2028". */
export const ClassYear = z.number().int().min(1950).max(2100);

/** Team and list colours: 6-digit hex only, so they work on native, RN Web and CSS alike. */
export const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #1E3F7B');

/** Who sees a post or event: one team (its members and families), everyone, or one group. */
export const TeamAudience = z.object({ scope: z.literal('team'), teamId: Id });
export const NetworkAudience = z.object({ scope: z.literal('network') });
export const GroupAudience = z.object({ scope: z.literal('group'), groupId: Id });

export const IdParams = z.object({ id: Id });
export type IdParams = z.infer<typeof IdParams>;

/** Cursor pagination for every list endpoint. Query values arrive as strings, hence the coerce. */
export const PageQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number<number>().int().min(1).max(100).default(20),
});
export type PageQuery = z.input<typeof PageQuery>;

export const page = <Item extends z.ZodType>(item: Item) =>
  z.object({
    items: z.array(item),
    /** Pass back as `cursor` for the next page; null when there are no more. */
    nextCursor: z.string().nullable(),
  });

export const ERROR_CODES = [
  'bad_request',
  'validation_error',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'internal_error',
] as const;
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Body of every non-2xx response. `issues` is set for validation errors so forms can show them inline. */
export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    issues: z
      .array(
        z.object({
          /** Where the problem is, starting with the request part: `['body', 'email']`. */
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
