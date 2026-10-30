import { CardFields, ExperienceEntry, MAX_EXPERIENCE_ENTRIES } from '@team-impact/contracts';
import { findDateRange, findGradYear, formatPeriod, recencyOf } from './dates';
import {
  CITY_STATE,
  DEGREE,
  hasDegree,
  HIGH_SCHOOL,
  isGraduateDegree,
  ORG,
  POSITION,
  regionOfState,
  SCHOOL,
  TITLE,
  withoutPlaces,
} from './gazetteer';
import { clean } from './guardrails';
import { bodyFontSize, headingKey, isBullet, linesOf, toEntries } from './layout';
import type { ExperienceCandidate, FieldCandidates, Line, Section } from './types';

/**
 * The no-LLM reader: feature scoring over the layout, after open-resume's approach (each field
 * scores candidate text by features with positive and negative weights; the best candidate wins,
 * and nothing is returned when no candidate scores above zero, so it never invents a value).
 * Fields are only looked for in their own section: the city only in the header (the spike took
 * home city from the school's location four times), dates only inside one entry's lines, major
 * and class year from the same degree.
 */

const titleCase = (s: string) =>
  s === s.toUpperCase()
    ? s
        .toLowerCase()
        .replace(/(^|[\s'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
    : s;

const valid = <K extends keyof CardFields>(key: K, value: unknown): CardFields[K] | null => {
  const ok = CardFields.shape[key].safeParse(value);
  return ok.success ? (ok.data as CardFields[K]) : null;
};

// Labelled lines ("Position: Midfielder") --------------------------------------------------------

const LABELS: Record<string, keyof CardFields> = {
  position: 'position',
  jersey: 'jerseyNumber',
  'jersey number': 'jerseyNumber',
  number: 'jerseyNumber',
  major: 'major',
  majors: 'major',
  'class year': 'classYear',
  class: 'classYear',
  'graduation year': 'classYear',
  'grad year': 'classYear',
  hometown: 'hometown',
  'looking for': 'lookingFor',
};

const labelled = (lines: Line[], out: FieldCandidates) => {
  for (const line of lines) {
    const m = /^\s*([A-Za-z ]{3,20}?)\s*:\s*(.+)$/.exec(line.text);
    const key = m && LABELS[m[1]!.toLowerCase().trim()];
    if (!key || out[key]) continue;
    const raw = clean(m[2]!);
    const value =
      key === 'classYear'
        ? findGradYear(raw)?.year
        : key === 'jerseyNumber'
          ? /\d{1,2}/.exec(raw)?.[0]
          : raw;
    const ok = valid(key, value);
    if (ok !== null) (out as Record<string, unknown>)[key] = { value: ok, confidence: 0.9 };
  }
};

// Name -------------------------------------------------------------------------------------------

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

const name = (profile: Line[], body: number, out: FieldCandidates) => {
  const top = profile.slice(0, 8);
  if (top.length === 0) return;
  const largest = Math.max(...top.map((l) => l.fontSize));
  const scored = top.map((line, i) => {
    const text = line.text.replace(/\s*[|•].*$/, '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    let score = 0;
    if (/^[\p{L}][\p{L}\s.'-]+$/u.test(text)) score += 3;
    if (words.length >= 2 && words.length <= 4) score += 2;
    else score -= 3;
    if (line.fontSize === largest && largest > body) score += 3;
    if (line.bold) score += 1;
    if (text === text.toUpperCase()) score += 1;
    if (i === 0) score += 1;
    if (/[@\d/,]/.test(text)) score -= 4;
    if (headingKey(line, body)) score -= 5;
    if (SCHOOL.test(text) || TITLE.test(text)) score -= 2;
    return { text, words, score, largestLine: line.fontSize === largest && largest > body };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score <= 3) return;
  const words = best.words.filter((w) => !NAME_SUFFIX.test(w)).map(titleCase);
  const first = valid('firstName', words[0]);
  const last = valid('lastName', words.length > 1 ? words.at(-1) : undefined);
  const margin = best.score - (scored[1]?.score ?? 0);
  const confidence = Math.min(0.95, 0.6 + (best.largestLine ? 0.15 : 0) + (margin >= 3 ? 0.15 : 0));
  if (first) out.firstName = { value: first, confidence };
  if (last) out.lastName = { value: last, confidence };
};

// Location (header only) -------------------------------------------------------------------------

const location = (profile: Line[], out: FieldCandidates) => {
  for (const line of profile.slice(0, 10)) {
    if (SCHOOL.test(line.text)) continue;
    const m = CITY_STATE.exec(line.text);
    if (!m) continue;
    const city = valid('city', m[1]);
    const region = regionOfState(m[2]!);
    if (city) out.city = { value: city, confidence: 0.8 };
    if (region) out.region = { value: region, confidence: 0.8 };
    return;
  }
};

// Education --------------------------------------------------------------------------------------

/** Everything after a degree token up to the next separator: the major(s) for that degree. */
const majorAfter = (text: string, from: number): string | null => {
  let rest = text.slice(from);
  rest = rest.replace(/^[\s,.:-]*(?:degree\s+)?(?:(?:in|of)\s+)?/i, '');
  rest = rest.replace(/^(?:a\s+)?(?:double|dual|joint)\s+major\s+(?:in\s+)?/i, '');
  const stop = rest.search(
    /\s*(?:\||;|•|\(|,\s*(?:minor|gpa|cum|magna|summa|class|expected|[A-Z][a-z]+,\s*[A-Z]{2})|\bminors?\b|\bgpa\b|\bcum laude\b|\bmagna\b|\bsumma\b|\bconcentration\b|\bexpected\b|\banticipated\b|\bclass of\b|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|(?:spring|summer|fall|winter)\s+(?:19|20)\d{2}|(?:19|20)\d{2}|\s{2,})/i,
  );
  const major = clean(stop >= 0 ? rest.slice(0, stop) : rest).replace(/[,.\s-]+$/, '');
  return major.length < 3 || hasDegree(major) ? null : major;
};

interface Degree {
  school: string | null;
  degree: string;
  major: string | null;
  graduate: boolean;
  gradYear: number | null;
  explicitYear: boolean;
}

const degreesIn = (entry: Line[]): Degree[] => {
  const text = withoutPlaces(entry.map((l) => l.segments.join('  ')).join('  '));
  const schoolLine = entry.find((l) => SCHOOL.test(l.text) && !hasDegree(l.text));
  const school = schoolLine ? clean(schoolLine.segments.find((s) => SCHOOL.test(s)) ?? '') : null;
  const grad = findGradYear(text);
  const found: Degree[] = [];
  for (const m of text.matchAll(DEGREE)) {
    found.push({
      school,
      degree: m[0],
      major: majorAfter(text, m.index + m[0].length),
      graduate: isGraduateDegree(m[0]),
      gradYear: grad?.year ?? null,
      explicitYear: grad?.explicit ?? false,
    });
  }
  // "Major: Economics" without a degree token.
  const labelledMajor = /\bmajors?\s*:\s*([^|;•(]+)/i.exec(text);
  if (found.length === 0 && labelledMajor) {
    found.push({
      school,
      degree: '',
      major: clean(labelledMajor[1]!).replace(/\s*(minor|gpa).*$/i, ''),
      graduate: false,
      gradYear: grad?.year ?? null,
      explicitYear: grad?.explicit ?? false,
    });
  }
  if (found.length === 0 && school) {
    found.push({
      school,
      degree: '',
      major: null,
      graduate: false,
      gradYear: grad?.year ?? null,
      explicitYear: grad?.explicit ?? false,
    });
  }
  return found;
};

const isSchoolLine = (l: Line) => SCHOOL.test(l.text) && !hasDegree(l.text);

/** Education entries start at each school's name; a GPA or honours line never starts one. */
const educationEntries = (lines: Line[]): Line[][] => {
  const entries: Line[][] = [];
  for (const line of lines) {
    const current = entries.at(-1);
    if (!current || (isSchoolLine(line) && current.some(isSchoolLine))) entries.push([line]);
    else current.push(line);
  }
  return entries;
};

const education = (sections: Section[], out: FieldCandidates, now: Date) => {
  const entries = educationEntries(linesOf(sections, 'education'));
  const all = entries.flatMap((entry) => {
    const highSchool = entry.some((l) => HIGH_SCHOOL.test(l.text));
    return degreesIn(entry).map((d) => ({ ...d, highSchool }));
  });
  const college = all.filter((d) => !d.highSchool);
  const pool = college.length > 0 ? college : all;
  const undergrad = pool.filter((d) => !d.graduate);
  const candidates = undergrad.length > 0 ? undergrad : pool;
  // The most recent degree; the major and the class year must come from the same one.
  const pick = [...candidates].sort((a, b) => (b.gradYear ?? 0) - (a.gradYear ?? 0))[0];
  if (!pick) return;
  // Several colleges with degrees: the spike's mixed-up cards came from exactly this case.
  const ambiguous = new Set(college.filter((d) => d.degree).map((d) => d.school)).size > 1;
  const major = pick.major ? valid('major', pick.major) : null;
  if (major) {
    const confidence = (pick.degree ? 0.85 : 0.7) - (ambiguous ? 0.15 : 0);
    out.major = { value: major, confidence };
  }
  const year = pick.gradYear !== null ? valid('classYear', pick.gradYear) : null;
  if (year !== null && year >= now.getFullYear() - 60 && year <= now.getFullYear() + 8) {
    out.classYear = {
      value: year,
      confidence: (pick.explicitYear ? 0.9 : 0.65) - (ambiguous ? 0.15 : 0),
    };
  }
};

// Experience -------------------------------------------------------------------------------------

const SEPARATORS = /\s+[|•·]\s+|\s+[–—-]\s+|\t/;

const titleScore = (s: string, bold: boolean) =>
  (TITLE.test(s) ? 3 : 0) - (ORG.test(s) && !TITLE.test(s) ? 2 : 0) - (bold ? 0.5 : 0);
const orgScore = (s: string, bold: boolean) =>
  (ORG.test(s) ? 3 : 0) - (TITLE.test(s) && !ORG.test(s) ? 2 : 0) + (bold ? 1 : 0);

const isLocation = (s: string) =>
  /^(remote|hybrid|on-?site)$/i.test(s) || new RegExp(`^${CITY_STATE.source}$`).test(s);

const truncate = (s: string, max: number) =>
  s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, '');

const readEntry = (entry: Line[], now: Date): ExperienceCandidate | null => {
  const firstBullet = entry.findIndex(isBullet);
  if (firstBullet === 0) return null;
  const header = entry.slice(
    0,
    firstBullet > 0 ? Math.min(firstBullet, 3) : Math.min(entry.length, 2),
  );
  const headerText = header.map((l) => l.segments.join('  ')).join('  ');
  const date = findDateRange(headerText);

  const pieces: { text: string; bold: boolean; order: number }[] = [];
  header.forEach((line, li) => {
    for (const segment of line.segments) {
      let s = segment;
      if (date) s = s.replace(date.text, ' ');
      s = clean(s)
        .replace(/^[,|•·–—-]+|[,|•·–—-]+$/g, '')
        .trim();
      // "Analytics Intern at Lumen Logistics"
      const at = /^(.+?)\s+at\s+(.+)$/i.exec(s);
      const parts = at ? [at[1]!, at[2]!] : s.split(SEPARATORS);
      for (const part of parts) {
        const p = clean(part).replace(/[,;:]+$/, '');
        if (!p || isLocation(p) || findDateRange(p)?.text === p) continue;
        // "Lumen Logistics, Analytics Intern": split a comma only when one side is a title.
        const comma = /^([^,]+),\s*([^,]+)$/.exec(p);
        if (comma && TITLE.test(comma[1]!) !== TITLE.test(comma[2]!)) {
          pieces.push({ text: comma[1]!.trim(), bold: line.bold, order: li * 10 + pieces.length });
          pieces.push({ text: comma[2]!.trim(), bold: line.bold, order: li * 10 + pieces.length });
        } else {
          pieces.push({ text: p, bold: line.bold, order: li * 10 + pieces.length });
        }
      }
    }
  });
  if (pieces.length === 0) return null;

  let role = pieces[0]!;
  let org: (typeof pieces)[number] | null = null;
  if (pieces.length > 1) {
    let best = -Infinity;
    for (const r of pieces) {
      for (const o of pieces) {
        if (r === o) continue;
        // Ties keep document order, preferring the bold line as the organisation.
        const score =
          titleScore(r.text, r.bold) + orgScore(o.text, o.bold) - (r.order > o.order ? 0.1 : 0);
        if (score > best) {
          best = score;
          role = r;
          org = o;
        }
      }
    }
  }

  const roleText = truncate(role.text, 60);
  const orgText = org ? truncate(org.text, 80) : '';
  const parsed = ExperienceEntry.safeParse({
    role: roleText,
    organization: orgText,
    period: date ? formatPeriod(date) : '',
  });
  if (!parsed.success) return null;
  let confidence = 0.55;
  if (TITLE.test(roleText)) confidence += 0.15;
  if (org && (ORG.test(orgText) || org.bold)) confidence += 0.1;
  if (date) confidence += 0.15;
  if (roleText !== role.text || orgText !== (org?.text ?? '')) confidence -= 0.2;
  return {
    entry: parsed.data,
    confidence: Math.min(0.95, confidence),
    recency: recencyOf(date, now),
  };
};

const experience = (sections: Section[], out: FieldCandidates, now: Date) => {
  const read = (keys: Parameters<typeof linesOf>[1][]) =>
    toEntries(linesOf(sections, ...keys))
      .map((e) => readEntry(e, now))
      .filter((e): e is ExperienceCandidate => e !== null);
  const work = read(['experience']).sort((a, b) => b.recency - a.recency);
  // Athletics rows fill the card only when there's room, and only leadership roles.
  const athletics = read(['athletics'])
    .filter((e) => /captain|president|leader|representative|rep\b|chair/i.test(e.entry.role))
    .sort((a, b) => b.recency - a.recency);
  const rows = [...work, ...athletics].slice(0, MAX_EXPERIENCE_ENTRIES);
  if (rows.length > 0) out.experience = rows;
};

// Athletics, skills, looking for -----------------------------------------------------------------

const athletics = (sections: Section[], out: FieldCandidates) => {
  const lines = [...linesOf(sections, 'athletics'), ...linesOf(sections, 'profile').slice(0, 6)];
  if (!out.position) {
    for (const line of lines) {
      const m = POSITION.exec(line.text);
      const value =
        m &&
        valid(
          'position',
          titleCase(m[1]!.toLowerCase()).replace(/^./, (c) => c.toUpperCase()),
        );
      if (value) {
        out.position = { value, confidence: 0.7 };
        break;
      }
    }
  }
  if (!out.jerseyNumber) {
    for (const line of linesOf(sections, 'athletics')) {
      const m = /(?:^|\s)(?:#|no\.\s?|jersey\s*(?:#|no\.?|number)?\s*)(\d{1,2})\b/i.exec(line.text);
      const value = m && valid('jerseyNumber', m[1]);
      if (value) {
        out.jerseyNumber = { value, confidence: 0.6 };
        break;
      }
    }
  }
};

const skills = (sections: Section[], out: FieldCandidates) => {
  const items = linesOf(sections, 'skills').flatMap((line) =>
    line.text
      .replace(/^[A-Za-z &/]{2,30}:\s*/, '')
      .split(/\s*[,;•|]\s*/)
      .map((s) => clean(s).replace(/\.$/, ''))
      .filter((s) => s.length >= 1 && s.length <= 40 && s.split(' ').length <= 5),
  );
  const unique = [...new Map(items.map((s) => [s.toLowerCase(), s])).values()].slice(0, 20);
  const value = unique.length > 0 ? valid('skills', unique) : null;
  if (value) out.skills = { value, confidence: 0.8 };
};

const lookingFor = (sections: Section[], out: FieldCandidates) => {
  if (out.lookingFor) return;
  const summary = sections.find(
    (s) => s.key === 'summary' && /objective|looking/i.test(s.heading ?? ''),
  );
  const text = summary ? clean(summary.lines.map((l) => l.text).join(' ')) : '';
  if (!text) return;
  const value = valid('lookingFor', truncate(text, 300));
  if (value) out.lookingFor = { value, confidence: 0.6 };
};

/** Every card field the layout supports, each with a confidence. */
export const extractHeuristic = (sections: Section[], now: Date): FieldCandidates => {
  const out: FieldCandidates = {};
  const all = sections.flatMap((s) => s.lines);
  const body = bodyFontSize(all);
  labelled(all, out);
  name(linesOf(sections, 'profile'), body, out);
  location(linesOf(sections, 'profile'), out);
  if (!out.major || !out.classYear) {
    const labelledMajor = out.major;
    const labelledYear = out.classYear;
    education(sections, out, now);
    if (labelledMajor) out.major = labelledMajor;
    if (labelledYear) out.classYear = labelledYear;
  }
  experience(sections, out, now);
  athletics(sections, out);
  skills(sections, out);
  lookingFor(sections, out);
  return out;
};
