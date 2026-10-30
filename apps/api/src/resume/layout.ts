import { clean, isSensitiveLine } from './guardrails';
import type { Line, Section, SectionKey, TextItem } from './types';

/**
 * Positioned text → reading-order lines → sections → entries. The approach follows open-resume's
 * parser (github.com/xitanggg/open-resume, `lib/parse-resume-from-pdf`): group items into lines,
 * find section headings by style and wording, split sections into entries at larger-than-usual
 * vertical gaps. That code is AGPL, so this is a re-implementation, not a port, and it adds what
 * open-resume lacks: two-column reading order (SmartResume, arXiv 2510.09722, found about 20% of
 * resumes are multi-column) and a heading dictionary instead of keyword-substring matching.
 */

/** Horizontal gap, in multiples of the font size, that splits a line into separate segments. */
const SEGMENT_GAP = 1.5;

const mostCommon = (values: number[]): number => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? 0;
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v;
  return best;
};

/**
 * The x of a vertical gutter running down the page (a two-column layout), or null. A gutter is a
 * band in the middle of the page that no body-text item crosses, with a real share of the text on
 * both sides. A large name across the top may cross it; it is read first as a header.
 */
const findGutter = (items: TextItem[], pageWidth: number): number | null => {
  if (items.length < 12) return null;
  const body = mostCommon(items.map((it) => Math.round(it.fontSize)));
  const crossers = items.filter((it) => it.fontSize <= body * 1.3);
  const allText = items.reduce((n, it) => n + it.text.length, 0);
  const balanced = (x: number) => {
    const left = crossers.filter((it) => it.x + it.width <= x);
    const right = crossers.filter((it) => it.x >= x);
    const rightText = right.reduce((n, it) => n + it.text.length, 0);
    const leftText = left.reduce((n, it) => n + it.text.length, 0);
    // Both columns carry real text, or it's just a right-aligned column of dates.
    return (
      left.length >= crossers.length * 0.2 &&
      right.length >= crossers.length * 0.2 &&
      rightText > allText * 0.2 &&
      leftText > allText * 0.15
    );
  };
  const bands: { x: number; width: number }[] = [];
  let runStart: number | null = null;
  const from = pageWidth * 0.2;
  const to = pageWidth * 0.8;
  for (let x = from; x <= to; x += 2) {
    const crossed = crossers.some((it) => it.x < x && it.x + it.width > x);
    if (!crossed) runStart ??= x;
    if ((crossed || x + 2 > to) && runStart !== null) {
      bands.push({ x: (runStart + x) / 2, width: x - runStart });
      runStart = null;
    }
  }
  const best = bands
    .filter((b) => b.width >= 8 && balanced(b.x))
    .sort((a, b) => b.width - a.width)[0];
  return best?.x ?? null;
};

/** Items at the same height become one line, left to right; wide gaps make separate segments. */
const groupLines = (items: TextItem[]): Line[] => {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    const ref = row?.[0];
    if (
      row &&
      ref &&
      Math.abs(item.y - ref.y) <= Math.max(2, Math.min(item.fontSize, ref.fontSize) * 0.5)
    ) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows.flatMap((row) => {
    row.sort((a, b) => a.x - b.x);
    const segments: string[] = [];
    let current = '';
    let prevEnd: number | null = null;
    for (const it of row) {
      const gap = prevEnd === null ? 0 : it.x - prevEnd;
      if (prevEnd !== null && gap > it.fontSize * SEGMENT_GAP) {
        segments.push(current);
        current = it.text;
      } else {
        const space = prevEnd !== null && gap > it.fontSize * 0.15 && !current.endsWith(' ');
        current += (space ? ' ' : '') + it.text;
      }
      prevEnd = it.x + it.width;
    }
    segments.push(current);
    const cleaned = segments.map(clean).filter(Boolean);
    const text = cleaned.join(' ');
    if (!text) return [];
    const chars = row.reduce((n, it) => n + it.text.length, 0);
    const boldChars = row.filter((it) => it.bold).reduce((n, it) => n + it.text.length, 0);
    return [
      {
        text,
        x: row[0]!.x,
        y: row[0]!.y,
        fontSize: Math.max(...row.map((it) => it.fontSize)),
        bold: boldChars > chars / 2,
        page: row[0]!.page,
        segments: cleaned,
      },
    ];
  });
};

/**
 * Reading-order lines for a whole document. A two-column page is read left column first, then
 * right. Lines that would carry an address or birthdate are dropped here, before anything reads
 * them.
 */
export const toLines = (items: TextItem[], pageWidth: number): Line[] => {
  const pages = [...new Set(items.map((it) => it.page))].sort((a, b) => a - b);
  const lines = pages.flatMap((page) => {
    const onPage = items.filter((it) => it.page === page && it.text.trim() !== '');
    const gutter = findGutter(onPage, pageWidth);
    if (gutter === null) return groupLines(onPage);
    // A full-width header (the name across the top) spans the gutter; keep it first.
    const spanning = onPage.filter((it) => it.x < gutter && it.x + it.width > gutter);
    const left = onPage.filter((it) => it.x + it.width <= gutter);
    const right = onPage.filter((it) => it.x >= gutter);
    return [...groupLines(spanning), ...groupLines(left), ...groupLines(right)];
  });
  return lines.filter((l) => !isSensitiveLine(l.text));
};

/** Plain text (pasted, or a text layer without positions) as lines. */
export const textToLines = (text: string): Line[] =>
  text
    .split(/\r?\n/)
    .map((raw, i) => {
      const segments = raw
        .split(/\t+| {3,}/)
        .map(clean)
        .filter(Boolean);
      return {
        text: segments.join(' '),
        x: raw.length - raw.trimStart().length,
        y: i * 12,
        fontSize: 10,
        bold: false,
        page: 1,
        segments,
      };
    })
    .filter((l) => l.text !== '' && !isSensitiveLine(l.text));

// Sections ---------------------------------------------------------------------------------------

/**
 * Heading wording → section. Built from common resume headings (the heading lists in
 * srbhr/Resume-Matcher and perminder-klair/resume-parser were the reference), plus the athlete
 * resume headings the card cares about.
 */
const HEADINGS: Record<Exclude<SectionKey, 'profile'>, string[]> = {
  summary: [
    'summary',
    'professional summary',
    'profile',
    'objective',
    'career objective',
    'about',
    'about me',
    'personal statement',
  ],
  education: [
    'education',
    'academic background',
    'academics',
    'education and training',
    'academic history',
    'education and honors',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'relevant experience',
    'employment',
    'employment history',
    'work history',
    'internships',
    'internship experience',
    'leadership',
    'leadership experience',
    'leadership and activities',
    'leadership and involvement',
    'activities',
    'campus involvement',
    'involvement',
    'volunteer',
    'volunteer experience',
    'volunteering',
    'community service',
    'community involvement',
    'extracurricular activities',
    'extracurriculars',
    'additional experience',
    'professional experience and leadership',
  ],
  athletics: [
    'athletics',
    'athletic experience',
    'athletic achievements',
    'athletic career',
    'varsity athletics',
    'collegiate athletics',
    'sports',
    'athletic involvement',
    'athletics and leadership',
  ],
  honors: [
    'honors',
    'awards',
    'honors and awards',
    'awards and honors',
    'achievements',
    'accomplishments',
    'recognition',
    'distinctions',
    'awards and recognition',
  ],
  skills: [
    'skills',
    'technical skills',
    'skills and interests',
    'languages',
    'core competencies',
    'qualifications',
    'skills and languages',
    'computer skills',
    'skills and certifications',
  ],
  coursework: [
    'relevant coursework',
    'coursework',
    'courses',
    'selected coursework',
    'certifications',
    'certificates',
    'licenses and certifications',
  ],
  projects: [
    'projects',
    'academic projects',
    'personal projects',
    'research',
    'research experience',
    'publications',
  ],
  other: ['interests', 'hobbies', 'references', 'additional information', 'personal interests'],
};

const HEADING_INDEX = new Map<string, SectionKey>(
  Object.entries(HEADINGS).flatMap(([key, names]) => names.map((n) => [n, key as SectionKey])),
);

const normalizeHeading = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The section a line opens, or null. The wording must match; style alone is not enough. */
export const headingKey = (line: Line, bodySize: number): SectionKey | null => {
  if (line.text.length > 48 || /\d{3,}/.test(line.text)) return null;
  const key = HEADING_INDEX.get(normalizeHeading(line.text.replace(/:$/, '')));
  if (!key) return null;
  const letters = line.text.replace(/[^A-Za-z]/g, '');
  const styled =
    line.headingHint === true ||
    line.bold ||
    line.fontSize > bodySize * 1.1 ||
    (letters.length > 0 && letters === letters.toUpperCase()) ||
    line.text.trim().endsWith(':');
  // A one-word line like "Leadership" in body text is still a heading if it stands alone and
  // matches exactly; pasted text has no styles at all.
  return styled || line.segments.length === 1 ? key : null;
};

export const bodyFontSize = (lines: Line[]): number =>
  mostCommon(lines.map((l) => Math.round(l.fontSize * 2) / 2)) || 10;

export const toSections = (lines: Line[]): Section[] => {
  const body = bodyFontSize(lines);
  const sections: Section[] = [{ key: 'profile', heading: null, lines: [] }];
  for (const line of lines) {
    const key = headingKey(line, body);
    if (key) sections.push({ key, heading: line.text, lines: [] });
    else sections.at(-1)!.lines.push(line);
  }
  return sections.filter((s) => s.key === 'profile' || s.lines.length > 0);
};

export const linesOf = (sections: Section[], ...keys: SectionKey[]): Line[] =>
  sections.filter((s) => keys.includes(s.key)).flatMap((s) => s.lines);

// Entries ----------------------------------------------------------------------------------------

const BULLET = /^\s*[•●▪■◦‣∙·○*–—-]\s*/;
export const isBullet = (line: Line) => BULLET.test(line.text);

/**
 * Splits a section into entries (one job, one school). A new entry starts at a gap noticeably
 * larger than the section's usual line gap (open-resume uses 1.4×), or when a plain line follows
 * bullet points, or at a bold line after a non-bold one.
 */
export const toEntries = (lines: Line[]): Line[][] => {
  if (lines.length === 0) return [];
  const gaps = lines
    .slice(1)
    .map((l, i) => (l.page === lines[i]!.page ? Math.round(l.y - lines[i]!.y) : 0))
    .filter((g) => g > 0);
  const usual = mostCommon(gaps) || 12;
  const entries: Line[][] = [[lines[0]!]];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = lines[i - 1]!;
    const gap = line.page === prev.page ? line.y - prev.y : Infinity;
    const startsLower = /^[a-z]/.test(line.text);
    const afterBullets = isBullet(prev) && !isBullet(line) && !startsLower;
    const boldStart = line.bold && !prev.bold && !isBullet(line) && entries.at(-1)!.some(isBullet);
    if (gap > usual * 1.4 || afterBullets || boldStart) entries.push([line]);
    else entries.at(-1)!.push(line);
  }
  return entries;
};
