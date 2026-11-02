import type { CardFields, ExperienceEntry } from '@team-impact/contracts';

/**
 * One run of text as the PDF (or OCR) placed it. `y` grows downwards from the top of the first
 * page, so sorting by `y` reads the document in order across pages.
 */
export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  bold: boolean;
  page: number;
}

/** A visual line: items at the same height in the same column, left to right. */
export interface Line {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  page: number;
  /** Pieces separated by a wide horizontal gap ("Intern      Jun 2025 – Aug 2025"). */
  segments: string[];
  /** Set by OCR when its layout model already labelled the line a heading. */
  headingHint?: boolean;
}

/** Resume sections we map headings onto. Anything above the first heading is `profile`. */
export type SectionKey =
  | 'profile'
  | 'summary'
  | 'education'
  | 'experience'
  | 'athletics'
  | 'honors'
  | 'skills'
  | 'coursework'
  | 'projects'
  | 'other';

export interface Section {
  key: SectionKey;
  heading: string | null;
  lines: Line[];
}

/** The fields the reader can propose: the card's own fields, nothing else. */
export type ExtractableKey = keyof CardFields;

/** A proposed value with how sure the reader is (0–1). Below `CHECK_BELOW` the athlete must check. */
export interface Candidate<T> {
  value: T;
  confidence: number;
}

export interface ExperienceCandidate {
  entry: ExperienceEntry;
  confidence: number;
  /** Sort key: the entry's end (or now, if current), as year * 12 + month. */
  recency: number;
}

export type FieldCandidates = {
  [K in Exclude<ExtractableKey, 'experience'>]?: Candidate<CardFields[K]>;
} & { experience?: ExperienceCandidate[] };

export const CHECK_BELOW = 0.75;
