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

/** Labelled birthdates ("DOB", "born") and any ISO day ("2005-01-01"), whatever the year. */
const BIRTHDATE =
  /\b(d\.?\s?o\.?\s?b\.?|date of birth|birth\s?date|birthday|born( on)?)\b|\b(19|20)\d{2}-\d{2}-\d{2}\b/i;

// Dates to the day --------------------------------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORD = '(?:st|nd|rd|th)?';

type Day = { index: number; end: number; year: number };
type DayReader = { re: RegExp; read: (m: RegExpExecArray, now: Date) => number | null };

/** Day and month in either order (US or European), each in range. */
const dayMonth = (a: string, b: string): boolean => {
  const [x, y] = [Number(a), Number(b)];
  return x >= 1 && y >= 1 && ((x <= 12 && y <= 31) || (y <= 12 && x <= 31));
};
const monthDay = (month: string, day: string): boolean =>
  MONTHS.some((m) => month.toLowerCase().startsWith(m)) && Number(day) >= 1 && Number(day) <= 31;

/**
 * The ways people write a day: "03/14/2004", "14.03.2004", "03-14-2004", "3/14/04", "2004/03/14",
 * "March 14, 2004", "14 March 2004", "14th of March 2004", "14-Mar-2004". Month and year alone
 * ("06/2022", "Aug 2022") are never a day. Two-digit years only with slashes, so a version number
 * ("Python 3.10.12") is not read as one.
 */
const DAY_READERS: DayReader[] = [
  {
    re: /\b(\d{1,2})([/.-])(\d{1,2})\2((?:19|20)\d{2})\b/g,
    read: (m) => (dayMonth(m[1]!, m[3]!) ? Number(m[4]) : null),
  },
  {
    re: /(?<![\d/.-])(\d{1,2})\/(\d{1,2})\/(\d{2})(?![\d/.-])/g,
    read: (m, now) => {
      if (!dayMonth(m[1]!, m[2]!)) return null;
      const yy = Number(m[3]);
      return yy <= now.getUTCFullYear() % 100 ? 2000 + yy : 1900 + yy;
    },
  },
  {
    re: /\b((?:19|20)\d{2})([/.-])(\d{1,2})\2(\d{1,2})\b/g,
    read: (m) => (dayMonth(m[3]!, m[4]!) ? Number(m[1]) : null),
  },
  {
    re: new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})${ORD},?\\s+((?:19|20)\\d{2})\\b`, 'gi'),
    read: (m) => (monthDay(m[1]!, m[2]!) ? Number(m[3]) : null),
  },
  {
    re: new RegExp(
      `\\b(\\d{1,2})${ORD}(?:\\s+of)?[\\s-]+${MONTH}\\.?,?[\\s-]+((?:19|20)\\d{2})\\b`,
      'gi',
    ),
    read: (m) => (monthDay(m[2]!, m[1]!) ? Number(m[3]) : null),
  },
];

/** Every day-precision date in the text, in order, without overlaps. */
const daysIn = (text: string, now: Date): Day[] => {
  const found: Day[] = [];
  for (const { re, read } of DAY_READERS) {
    for (const m of text.matchAll(re)) {
      const year = read(m, now);
      if (year !== null) found.push({ index: m.index, end: m.index + m[0].length, year });
    }
  }
  found.sort((a, b) => a.index - b.index || b.end - a.end);
  const kept: Day[] = [];
  for (const d of found) if (d.index >= (kept.at(-1)?.end ?? 0)) kept.push(d);
  return kept;
};

const DATE_ISH = `(?:\\d|${MONTH}\\.?|present|current|now|today|date|spring|summer|fall|autumn|winter)`;
/** "06/01/2022 – 08/31/2022", "– Present": the date is one end of a range. */
const RANGE_AFTER = new RegExp(`^\\s*(?:[-–—~]|to|through|thru|until|till)\\s*${DATE_ISH}`, 'i');
const RANGE_BEFORE = new RegExp(
  `(?:\\d|\\b${MONTH}\\.?|present|current)\\s*(?:[-–—~]|to|through|thru|until|till|and)\\s*$`,
  'i',
);
/** A date said to be something else: "Graduated 05/15/2010", "Since 06/01/2010", "Issued …". */
const EVENT_BEFORE =
  /\b(graduat\w*|conferred|awarded|issued|earned|completed|certified|expir\w*|hired|start\w*|began|joined|effective|signed|committed|since|from|between)\b[\s:,-]*$/i;

/**
 * Days that could be a birthdate: old enough for someone at least 13 (year ≤ this year − 13),
 * not one end of a range, and not labelled as some other event. A birthdate needs no label to be
 * one: "Jordan Lee | 03/14/2004 | Boston" gives it away just as well.
 */
const birthdateLike = (text: string, now: Date): Day[] => {
  const latest = now.getUTCFullYear() - 13;
  return daysIn(text, now).filter((d) => {
    if (d.year > latest) return false;
    const before = text.slice(0, d.index);
    const after = text.slice(d.end);
    return !RANGE_AFTER.test(after) && !RANGE_BEFORE.test(before) && !EVENT_BEFORE.test(before);
  });
};

// Addresses ---------------------------------------------------------------------------------------

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

/**
 * True for a line that would carry an address or a birthdate. Such lines are never read. A line
 * with exactly one birthdate-like day counts; experience dates ("06/01/2022 – 08/31/2022") and
 * recent ones ("Graduated 05/15/2026") do not.
 */
export const isSensitiveLine = (text: string, now: Date = new Date()): boolean =>
  BIRTHDATE.test(text) ||
  STREET.test(text) ||
  LABELLED_ADDRESS.test(text) ||
  birthdateLike(text, now).length === 1;

// Contact details ---------------------------------------------------------------------------------

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const URL = /\b(https?:\/\/|www\.)\S+/gi;
/** Skill names that are also domains ("ASP.NET", "VB.net"); "Node.js" never matches (no `js`). */
const SKILL_DOMAIN = /^(asp|ado|vb)\.net\b/i;
/**
 * "github.com/jlee", "Instagram.com/jlee": any domain with a path. The top-level domain is
 * lowercase and never `js`, so "Node.js/Express", "ASP.NET/C#" and "B.S./M.S." are kept.
 */
const PATH_LINK =
  /(?<![\w.@-])[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9-]+)*\.(?!js\/)[a-z]{2,}\/\S*/g;
/**
 * "jlee.dev", "x.com", "GitHub.com": bare domains only with common endings, and the ending in
 * lowercase, so "ASP.NET" is kept (and "ASP.net" by `SKILL_DOMAIN`).
 */
const BARE_DOMAIN =
  /(?<![\w.@-])[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9-]+)*\.(?:com|org|net|edu|io|dev|me|co|ai|app|gg|tv|uk|ca|us|info|xyz|tech|site)(?![\w-]|\.[a-z0-9])/g;
/** "@jlee" (emails are already gone by then). */
const HANDLE = /(?<![\w.@])@[A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?/g;

/** "+44 7911 123456", "+33 6 12 34 56 78": a plus and 8–15 digits. */
const PHONE_INTL = /\+(?:[\s.()-]*\d){8,15}(?!\d)/g;
const PHONE_US = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
/** "07911 123456", "06 12 34 56 78": national numbers of 10–15 digits. */
const PHONE_NATIONAL = /(?<![\w+])\(?\d(?:[\s.()-]*\d){9,14}(?!\d)/g;
/** "2015 2016 2017", "2019-20 2020-21": years in a row, never a phone number. */
const YEARS_ONLY = /^(?:(?:19|20)\d{2}(?:-\d{2}(?!\d))?[\s.()-]*)+$/;
/** "3.85 3.90 3.95": decimals in a row (stats, GPAs) mix dots and spaces; a phone number doesn't. */
const notPhone = (m: string) => YEARS_ONLY.test(m) || (m.includes('.') && /\s/.test(m));
const phone = (m: string) => (notPhone(m) ? m : '[phone]');

const stripDates = (text: string, now: Date): string =>
  birthdateLike(text, now)
    .reverse()
    .reduce((t, d) => `${t.slice(0, d.index)}[date]${t.slice(d.end)}`, text);

/**
 * Removes contact details from text that leaves our servers (the optional LLM pass). The card's
 * contact details come from the athlete's settings, never from the resume. Birthdate-like days are
 * replaced too, behind the line filter in `isSensitiveLine`.
 */
export const stripContacts = (text: string, now: Date = new Date()): string =>
  stripDates(
    text
      .replace(EMAIL, '[email]')
      .replace(URL, '[link]')
      .replace(PATH_LINK, (m) => (SKILL_DOMAIN.test(m) ? m : '[link]'))
      .replace(BARE_DOMAIN, (m) => (SKILL_DOMAIN.test(m) ? m : '[link]'))
      .replace(HANDLE, '[handle]'),
    now,
  )
    .replace(PHONE_INTL, phone)
    .replace(PHONE_NATIONAL, phone)
    .replace(PHONE_US, '[phone]');
