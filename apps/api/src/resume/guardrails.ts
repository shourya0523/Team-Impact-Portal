/**
 * Resume text is untrusted data (CLAUDE.md, PRD §4). Everything read from a file passes through
 * here first: markup and control characters go, and lines that carry an address or a birthdate
 * are dropped before any extractor (heuristic or LLM) sees them, so neither can be kept.
 */

/** Control characters, markup brackets and zero-width characters out; whitespace collapsed. */
export const clean = (s: string): string =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>\u200b-\u200f\u2028\u2029\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const BIRTHDATE =
  /\b(d\.?\s?o\.?\s?b\.?|date of birth|birth\s?date|birthday|born( on)?)\b|\b(19|20)\d{2}-\d{2}-\d{2}\b/i;

const STREET_SUFFIX =
  '(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|ter|circle|cir|parkway|pkwy|highway|hwy)';
/**
 * "12 Elm Street", "4410 W. Oak Ave, Apt 3", "PO Box 12". A year never starts a street number, so
 * "May 2026 West Hartford CT" on an education line is kept.
 */
const STREET = new RegExp(
  `\\b(?!(19|20)\\d{2}\\b)\\d{1,5}\\s+([nsew]\\.?\\s+)?[a-z0-9.'-]+(\\s+[a-z0-9.'-]+){0,3}\\s+${STREET_SUFFIX}\\b\\.?|\\b(p\\.?\\s?o\\.?\\s+box|apt\\.?|suite|unit)\\s*#?\\s*\\d+`,
  'i',
);
const LABELLED_ADDRESS = /^\s*(home\s+|mailing\s+|permanent\s+)?address\s*:/i;

/** True for a line that would carry an address or a birthdate. Such lines are never read. */
export const isSensitiveLine = (text: string): boolean =>
  BIRTHDATE.test(text) || STREET.test(text) || LABELLED_ADDRESS.test(text);

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const URL = /\b(https?:\/\/|www\.)\S+|\blinkedin\.com\/\S+/gi;

/**
 * Removes contact details from text that leaves our servers (the optional LLM pass). The card's
 * contact details come from the athlete's settings, never from the resume.
 */
export const stripContacts = (text: string): string =>
  text.replace(EMAIL, '[email]').replace(URL, '[link]').replace(PHONE, '[phone]');
