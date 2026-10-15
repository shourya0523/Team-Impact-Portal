import { QrCodeParams } from '@team-impact/contracts';
import { ApiRequestError } from '@/api/client';

/**
 * The code inside a scanned QR or a pasted link. A coach's QR is a link to `/scan?code=XXXXXXXX`
 * (`joinLink` in `(app)/team/qr.tsx`), but a bare token or short code works too, typed any way
 * (`abcd-2345`). Anything else, like a website's QR, is null.
 */
export const codeFromScan = (data: string): string | null => {
  const value = data.trim();
  const fromLink = /[?&]code=([^&#]+)/.exec(value)?.[1];
  if (fromLink === undefined && value.includes('://')) return null;
  let candidate = value;
  if (fromLink !== undefined) {
    try {
      candidate = decodeURIComponent(fromLink);
    } catch {
      return null; // a broken %-escape
    }
  }
  const parsed = QrCodeParams.shape.code.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

/** What went wrong with a code, and what the person can do next. */
export type QrProblem = {
  title: string;
  body: string;
  /** `other`: try a different code. `retry`: the same request again. `enter`: go into the app. */
  next: 'other' | 'retry' | 'enter';
};

/** A scan or typed value that holds no Team IMPACT code at all. */
export const NOT_A_CODE: QrProblem = {
  title: 'That isn’t a Team IMPACT code',
  body: 'Check it’s the code your coach shared. Codes are 8 letters and numbers, printed under the QR.',
  next: 'other',
};

/**
 * Dead and bad codes, told apart by status. The API sends every 410 (expired, turned off, team not
 * taking members) with the same error code, so its message is what names the reason.
 */
export const qrProblem = (e: unknown): QrProblem => {
  if (e instanceof ApiRequestError) {
    if (e.status === 410)
      return { title: 'This code doesn’t work any more', body: e.message, next: 'other' };
    if (e.status === 404 || e.status === 400) return NOT_A_CODE;
    if (e.status === 409)
      return { title: 'You’re already on this team', body: e.message, next: 'enter' };
    if (e.status < 500) return { title: 'This code can’t be used', body: e.message, next: 'other' };
  }
  return {
    title: 'Couldn’t check the code',
    body: 'Check your connection and try again.',
    next: 'retry',
  };
};
