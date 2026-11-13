/**
 * Dates on resumes: "Jun 2024 – Aug 2024", "Summer 2025", "06/2024 - Present", "2021–22" (a sports
 * season), "Expected May 2027", "Class of 2027". The spike's most common experience error was a
 * date lost or swapped between neighbouring roles (TI-139), so callers only ever look for dates
 * inside one entry's own lines.
 */

export interface DatePoint {
  year: number;
  month?: number;
  season?: Season;
}

export interface DateRange {
  start: DatePoint;
  /** Null when the range runs to "Present" or names only one point. */
  end: DatePoint | null;
  current: boolean;
  /** The matched text, so callers can cut it out of the line. */
  text: string;
}

type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABEL = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const SEASON_MONTH: Record<Season, number> = { Spring: 3, Summer: 6, Fall: 9, Winter: 12 };

const MON =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const SEAS = '(?:spring|summer|fall|autumn|winter)';
const YEAR4 = '(?:19|20)\\d{2}';
const YEAR = `(?:${YEAR4}|['’]\\d{2})`;
const POINT = `(?:(?:${MON}|${SEAS})\\s*,?\\s*${YEAR}|\\d{1,2}\\/(?:${YEAR4}|\\d{2})|${YEAR4})`;
const NOW = '(?:present|current|now|ongoing|today)';
const DASH = '\\s*(?:-|–|—|to|until|through|thru)\\s*';

const RANGE = new RegExp(`\\b(${POINT})${DASH}(${POINT}|${NOW})\\b`, 'i');
/** "2021–22": a sports season, or a school year. */
const SEASON_SPAN = new RegExp(`\\b(${YEAR4})\\s*[-–—/]\\s*(\\d{2})\\b(?![\\d/])`);
const SINGLE = new RegExp(`\\b(${POINT})\\b`, 'i');

const expandYear = (raw: string): number => {
  const digits = raw.replace(/['’]/, '');
  return digits.length === 2 ? 2000 + Number(digits) : Number(digits);
};

export const parsePoint = (raw: string): DatePoint | null => {
  const text = raw.trim().toLowerCase();
  const slash = /^(\d{1,2})\/(\d{2,4})$/.exec(text);
  if (slash) {
    const month = Number(slash[1]);
    return month >= 1 && month <= 12 ? { year: expandYear(slash[2]!), month } : null;
  }
  const year = /(?:19|20)\d{2}|['’]\d{2}/.exec(text);
  if (!year) return null;
  const season = new RegExp(`^${SEAS}`).exec(text)?.[0];
  if (season) {
    const s = (season === 'autumn' ? 'Fall' : season[0]!.toUpperCase() + season.slice(1)) as Season;
    return { year: expandYear(year[0]), season: s, month: SEASON_MONTH[s] };
  }
  const month = MONTHS.findIndex((m) => text.startsWith(m));
  return month >= 0
    ? { year: expandYear(year[0]), month: month + 1 }
    : { year: expandYear(year[0]) };
};

/** The first date range in `text`, or a single date standing alone ("Summer 2025"). */
export const findDateRange = (text: string): DateRange | null => {
  const range = RANGE.exec(text);
  if (range) {
    const start = parsePoint(range[1]!);
    const current = new RegExp(`^${NOW}$`, 'i').test(range[2]!);
    const end = current ? null : parsePoint(range[2]!);
    if (start && (current || end)) return { start, end, current, text: range[0] };
  }
  const span = SEASON_SPAN.exec(text);
  if (span) {
    const startYear = Number(span[1]);
    const endYear = Math.floor(startYear / 100) * 100 + Number(span[2]);
    if (endYear === startYear + 1) {
      return { start: { year: startYear }, end: { year: endYear }, current: false, text: span[0] };
    }
  }
  const single = SINGLE.exec(text);
  const point = single && parsePoint(single[1]!);
  return point ? { start: point, end: null, current: false, text: single[0] } : null;
};

const label = (p: DatePoint): string =>
  p.season
    ? `${p.season} ${p.year}`
    : p.month
      ? `${MONTH_LABEL[p.month - 1]} ${p.year}`
      : `${p.year}`;

/** The card's period text, at most 30 characters: "Jun 2024 – Aug 2024", "Summer 2025". */
export const formatPeriod = (r: DateRange): string => {
  const start = label(r.start);
  if (r.current) return `${start} – Present`;
  if (!r.end) return start;
  const end = label(r.end);
  return start === end ? start : `${start} – ${end}`;
};

/** For ordering entries newest first: months since year 0, "Present" counting as `now`. */
export const recencyOf = (r: DateRange | null, now: Date): number => {
  if (!r) return 0;
  if (r.current) return now.getFullYear() * 12 + now.getMonth() + 1;
  const p = r.end ?? r.start;
  return p.year * 12 + (p.month ?? 6);
};

const GRAD = new RegExp(
  `\\b(?:expected|anticipated|class of|graduat\\w*|grad\\.?|degree expected)\\s*:?\\s*(?:(?:${MON}|${SEAS})\\s*,?\\s*)?(${YEAR4}|['’]\\d{2})\\b`,
  'i',
);

/**
 * The graduation year in an education entry: an explicit "Expected May 2027" / "Class of 2027"
 * wins, then the end of a date range, then the latest year mentioned.
 */
export const findGradYear = (text: string): { year: number; explicit: boolean } | null => {
  const grad = GRAD.exec(text);
  if (grad) return { year: expandYear(grad[1]!), explicit: true };
  const range = RANGE.exec(text);
  if (range) {
    const end = parsePoint(range[2]!);
    if (end) return { year: end.year, explicit: false };
  }
  const years = [...text.matchAll(new RegExp(`\\b${YEAR4}\\b`, 'g'))].map((m) => Number(m[0]));
  return years.length > 0 ? { year: Math.max(...years), explicit: false } : null;
};
