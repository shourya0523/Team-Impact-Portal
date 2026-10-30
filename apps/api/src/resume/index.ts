import {
  EXTRACTABLE_CARD_FIELDS,
  type CardFields,
  type ExperienceEntry,
  type UpdateCardRequest,
} from '@team-impact/contracts';
import { extractHeuristic } from './heuristic';
import { bodyFontSize, textToLines, toLines, toSections } from './layout';
import { extractWithLlm, type LlmConfig } from './llm';
import { ocrWithDocling, type DoclingConfig } from './ocr';
import { MIN_TEXT_CHARS, readPdf, ResumeReadError } from './pdf';
import { CHECK_BELOW, type ExperienceCandidate, type FieldCandidates, type Line } from './types';

export { ResumeReadError } from './pdf';
export type { DoclingConfig } from './ocr';
export type { LlmConfig } from './llm';

/**
 * TI-113: resume (PDF or photo) → card fields for the athlete to check. Pipeline:
 *
 *   PDF with text ─ pdf.js positioned text ─┐
 *   photo / scan ─ docling-serve OCR ───────┴─ lines → sections → layout reader ─┐
 *                                                     (optional) grounded LLM ───┴─ merge
 *
 * Nothing here stores the file: bytes come in, card-shaped fields go out, and the caller drops the
 * bytes. Every value is validated against the card schema, and low-confidence values are flagged
 * so the review screen makes the athlete look at them ("Check").
 */
export interface ResumeReaderConfig {
  llm?: LlmConfig | null;
  docling?: DoclingConfig | null;
  fetch?: typeof fetch;
}

export type ResumeFailure = ResumeReadError['reason'] | 'wrong_file_type' | 'nothing_found';
export type ResumeMethod = 'layout' | 'layout+llm' | 'ocr' | 'ocr+llm';

export interface ResumeReading {
  fields: UpdateCardRequest;
  needsReview: (keyof CardFields)[];
  check: (keyof CardFields)[];
  checkEntries: number[];
  failed: boolean;
  reason: ResumeFailure | null;
  method: ResumeMethod | null;
}

const startsWith = (bytes: Uint8Array, sig: number[], at = 0) =>
  sig.every((b, i) => bytes[at + i] === b);

/** The file's first bytes must match its declared type: a renamed file is refused before parsing. */
export const matchesType = (bytes: Uint8Array, mimeType: string): boolean => {
  switch (mimeType) {
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/heic': {
      const brand = String.fromCharCode(...bytes.slice(8, 12));
      return (
        startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) && /^(heic|heix|mif1|msf1|hevc)$/.test(brand)
      );
    }
    default:
      return false;
  }
};

const norm = (v: unknown) =>
  JSON.stringify(v)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const sameEntry = (a: ExperienceEntry, b: ExperienceEntry) =>
  norm(a.role) === norm(b.role) ||
  (norm(a.organization) !== '' &&
    norm(a.organization) === norm(b.organization) &&
    a.period === b.period);

/**
 * Layout reader and LLM agree → more confident. They disagree → the grounded LLM value, flagged.
 * Only one has a value → that one, at its own confidence.
 */
export const mergeCandidates = (
  layout: FieldCandidates,
  llm: FieldCandidates | null,
): FieldCandidates => {
  if (!llm) return layout;
  const out: FieldCandidates = {};
  const keys = new Set([...Object.keys(layout), ...Object.keys(llm)]) as Set<keyof FieldCandidates>;
  for (const key of keys) {
    if (key === 'experience') continue;
    const a = layout[key] as { value: unknown; confidence: number } | undefined;
    const b = llm[key] as { value: unknown; confidence: number } | undefined;
    const merged =
      a && b
        ? norm(a.value) === norm(b.value)
          ? {
              value: a.value,
              confidence: Math.min(0.97, Math.max(a.confidence, b.confidence) + 0.1),
            }
          : { value: b.value, confidence: 0.6 }
        : (a ?? b);
    if (merged) (out as Record<string, unknown>)[key] = merged;
  }
  const fromLlm = llm.experience ?? [];
  const fromLayout = layout.experience ?? [];
  const rows: ExperienceCandidate[] =
    fromLlm.length > 0
      ? fromLlm.map((e) => {
          const match = fromLayout.find((h) => sameEntry(h.entry, e.entry));
          return match && match.entry.period === e.entry.period
            ? { ...e, confidence: Math.min(0.95, Math.max(e.confidence, match.confidence) + 0.1) }
            : { ...e, confidence: Math.min(e.confidence, 0.7) };
        })
      : fromLayout;
  if (rows.length > 0) out.experience = rows;
  return out;
};

/** Candidates → what the API returns: plain values, review order, "Check" flags. */
export const toReading = (candidates: FieldCandidates, method: ResumeMethod): ResumeReading => {
  const fields: Record<string, unknown> = {};
  const check: (keyof CardFields)[] = [];
  const checkEntries: number[] = [];
  for (const key of EXTRACTABLE_CARD_FIELDS) {
    if (key === 'experience') {
      const rows = candidates.experience ?? [];
      if (rows.length === 0) continue;
      fields.experience = rows.map((r) => r.entry);
      rows.forEach((r, i) => {
        if (r.confidence < CHECK_BELOW || r.entry.period === '') checkEntries.push(i);
      });
      if (checkEntries.length > 0) check.push('experience');
      continue;
    }
    const c = candidates[key] as { value: unknown; confidence: number } | undefined;
    if (!c) continue;
    fields[key] = c.value;
    if (c.confidence < CHECK_BELOW) check.push(key);
  }
  const needsReview = EXTRACTABLE_CARD_FIELDS.filter((k) => k in fields);
  return {
    fields: fields as UpdateCardRequest,
    needsReview: [...needsReview],
    check,
    checkEntries,
    failed: needsReview.length === 0,
    reason: needsReview.length === 0 ? 'nothing_found' : null,
    method: needsReview.length === 0 ? null : method,
  };
};

const failure = (reason: ResumeFailure): ResumeReading => ({
  fields: {},
  needsReview: [],
  check: [],
  checkEntries: [],
  failed: true,
  reason,
  method: null,
});

/** Lines → reading, through the layout reader and (if configured) the LLM. */
export const readLines = async (
  lines: Line[],
  base: 'layout' | 'ocr',
  config: ResumeReaderConfig,
  now: Date,
): Promise<ResumeReading> => {
  const sections = toSections(lines);
  const layout = extractHeuristic(sections, now);
  const llm = config.llm
    ? await extractWithLlm(lines, bodyFontSize(lines), config.llm, now, config.fetch)
    : null;
  const method: ResumeMethod = llm ? `${base}+llm` : base;
  return toReading(mergeCandidates(layout, llm), method);
};

/** Pasted or plain text: the same reader, without positions or styles. */
export const readResumeText = (text: string, config: ResumeReaderConfig = {}, now = new Date()) =>
  readLines(textToLines(text), 'layout', config, now);

/**
 * A resume file → a reading. Never throws for a bad file: an unreadable, oversized or wrong file
 * comes back `failed` with a reason, and the athlete types their card in instead.
 */
export const readResume = async (
  file: { bytes: Uint8Array; mimeType: string; fileName: string },
  config: ResumeReaderConfig = {},
  now = new Date(),
): Promise<ResumeReading> => {
  if (!matchesType(file.bytes, file.mimeType)) return failure('wrong_file_type');
  try {
    if (file.mimeType === 'application/pdf') {
      const { items, pageWidth } = await readPdf(file.bytes);
      const chars = items.reduce((n, it) => n + it.text.trim().length, 0);
      if (chars >= MIN_TEXT_CHARS)
        return await readLines(toLines(items, pageWidth), 'layout', config, now);
      // A scanned PDF: no text layer.
    }
    if (!config.docling)
      return failure(file.mimeType === 'application/pdf' ? 'no_text' : 'ocr_unavailable');
    const { lines } = await ocrWithDocling(file, config.docling, config.fetch);
    if (lines.length === 0) return failure('no_text');
    return await readLines(lines, 'ocr', config, now);
  } catch (e) {
    if (e instanceof ResumeReadError) return failure(e.reason);
    return failure('unreadable');
  }
};

/** Reader settings from the environment (see `.env.example`). */
export const resumeConfigFromEnv = (env: {
  RESUME_LLM?: 'off' | 'openai';
  OPENAI_API_KEY?: string;
  RESUME_LLM_MODEL?: string;
  OPENAI_BASE_URL?: string;
  DOCLING_URL?: string;
  DOCLING_API_KEY?: string;
}): ResumeReaderConfig => ({
  llm:
    env.RESUME_LLM === 'openai' && env.OPENAI_API_KEY
      ? {
          apiKey: env.OPENAI_API_KEY,
          model: env.RESUME_LLM_MODEL ?? 'gpt-4.1-mini',
          baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        }
      : null,
  docling: env.DOCLING_URL ? { url: env.DOCLING_URL, apiKey: env.DOCLING_API_KEY } : null,
});
