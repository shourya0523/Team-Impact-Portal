import { z } from 'zod';

/**
 * The legal text users accept at sign-up (TI-107): Terms of Use, Privacy Policy and Acceptable
 * Use Policy. The source is `docs/legal/*.md`; see `docs/legal/README.md` for the rules.
 *
 * The three documents are versioned together as one bundle, so one acceptance names one version.
 * Any change to any of them, even a typo, gets a new version here and in each file's header, and
 * every sign-up then has to send the new version (`TermsVersion`). Earlier acceptances keep the
 * version they were given, so we can always tell who agreed to which text.
 */
export const CURRENT_TERMS_VERSION = '2026-11-draft.1';
export type CurrentTermsVersion = typeof CURRENT_TERMS_VERSION;

/** DRAFT until Team Impact's counsel signs off; the App Store build must not ship a draft. */
export const LEGAL_STATUS: 'draft' | 'final' = 'draft';

export const LEGAL_DOCUMENT_IDS = ['terms', 'privacy', 'acceptable-use'] as const;
export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  /** Always `CURRENT_TERMS_VERSION`: the bundle shares one version. */
  version: CurrentTermsVersion;
  /** Where the text lives in the repo. Its header names the same version. */
  source: string;
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: 'terms',
    title: 'Terms of Use',
    version: CURRENT_TERMS_VERSION,
    source: 'docs/legal/terms.md',
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    version: CURRENT_TERMS_VERSION,
    source: 'docs/legal/privacy.md',
  },
  'acceptable-use': {
    id: 'acceptable-use',
    title: 'Acceptable Use Policy',
    version: CURRENT_TERMS_VERSION,
    source: 'docs/legal/acceptable-use.md',
  },
};

/** "Terms of Use, Privacy Policy and Acceptable Use Policy", for sign-up labels. */
export const LEGAL_DOCUMENT_NAMES = (() => {
  const titles = LEGAL_DOCUMENT_IDS.map((id) => LEGAL_DOCUMENTS[id].title);
  return `${titles.slice(0, -1).join(', ')} and ${titles.at(-1)}`;
})();

/**
 * The version a sign-up accepts. Only the current one is valid: a client showing older text gets
 * a 400 and must reload, so a stored acceptance always names text the user could have read.
 */
export const TermsVersion = z.literal(CURRENT_TERMS_VERSION, {
  error: `The terms have changed. Reload to read the current ${LEGAL_DOCUMENT_NAMES}.`,
});
export type TermsVersion = z.infer<typeof TermsVersion>;

/**
 * The flags an acceptance is stored under (`consent_records.flag`, append-only, with
 * `terms_version`). A teen's sign-up writes both: their own acceptance and their confirmation that
 * a parent or guardian agreed.
 */
export const CONSENT_FLAGS = { terms: 'terms', parentAgreed: 'parent_agreed' } as const;
export type ConsentFlag = (typeof CONSENT_FLAGS)[keyof typeof CONSENT_FLAGS];
