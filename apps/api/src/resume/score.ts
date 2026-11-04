import type { CardFields, ExperienceEntry, UpdateCardRequest } from '@team-impact/contracts';

/**
 * Scores a reading against a hand-checked answer, with the TI-139 spike's legend so results compare
 * directly: correct, missing, wrong, extra (a value the resume doesn't support). Experience is
 * scored per entry: entries are matched by role, and an entry is correct only when role,
 * organisation and period all match.
 */
export type Outcome = 'correct' | 'missing' | 'wrong' | 'extra' | 'absent';

export const SCORED_FIELDS = [
  'firstName',
  'lastName',
  'major',
  'classYear',
  'city',
  'region',
  'position',
  'jerseyNumber',
] as const satisfies readonly (keyof CardFields)[];

const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
const overlap = (a: string, b: string) => {
  const x = words(a);
  const y = words(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.max(1, Math.min(x.size, y.size));
};

export interface EntryScore {
  correct: number;
  wrong: number;
  missing: number;
  extra: number;
}

export const scoreExperience = (got: ExperienceEntry[], want: ExperienceEntry[]): EntryScore => {
  const left = [...got];
  const score: EntryScore = { correct: 0, wrong: 0, missing: 0, extra: 0 };
  for (const w of want) {
    let best = -1;
    let bestOverlap = 0.5;
    left.forEach((g, i) => {
      const o = overlap(g.role, w.role);
      if (o >= bestOverlap) {
        best = i;
        bestOverlap = o;
      }
    });
    if (best < 0) {
      score.missing++;
      continue;
    }
    const [g] = left.splice(best, 1);
    const ok =
      norm(g!.role) === norm(w.role) &&
      norm(g!.organization) === norm(w.organization) &&
      norm(g!.period) === norm(w.period);
    if (ok) score.correct++;
    else score.wrong++;
  }
  score.extra = left.length;
  return score;
};

export const scoreField = (got: unknown, want: unknown): Outcome => {
  const has = got !== undefined && got !== null && got !== '';
  const expected = want !== undefined && want !== null && want !== '';
  if (!expected) return has ? 'extra' : 'absent';
  if (!has) return 'missing';
  return norm(got) === norm(want) ? 'correct' : 'wrong';
};

export interface ResumeScore {
  fields: Record<(typeof SCORED_FIELDS)[number], Outcome>;
  experience: EntryScore;
}

export const scoreReading = (got: UpdateCardRequest, want: UpdateCardRequest): ResumeScore => ({
  fields: Object.fromEntries(
    SCORED_FIELDS.map((k) => [k, scoreField(got[k], want[k])]),
  ) as ResumeScore['fields'],
  experience: scoreExperience(got.experience ?? [], want.experience ?? []),
});

/** Accuracy = correct ÷ cases where the field was on the resume (the spike's definition). */
export const summarize = (scores: ResumeScore[]) => {
  const fields = Object.fromEntries(
    SCORED_FIELDS.map((k) => {
      const outcomes = scores.map((s) => s.fields[k]);
      const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
      const present = count('correct') + count('wrong') + count('missing');
      return [
        k,
        {
          correct: count('correct'),
          present,
          wrong: count('wrong'),
          missing: count('missing'),
          extra: count('extra'),
        },
      ];
    }),
  ) as Record<
    (typeof SCORED_FIELDS)[number],
    { correct: number; present: number; wrong: number; missing: number; extra: number }
  >;
  const exp = scores.reduce(
    (t, s) => ({
      correct: t.correct + s.experience.correct,
      wrong: t.wrong + s.experience.wrong,
      missing: t.missing + s.experience.missing,
      extra: t.extra + s.experience.extra,
    }),
    { correct: 0, wrong: 0, missing: 0, extra: 0 },
  );
  return { fields, experience: { ...exp, present: exp.correct + exp.wrong + exp.missing } };
};
