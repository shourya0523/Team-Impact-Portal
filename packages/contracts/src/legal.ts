import { z } from 'zod';

/**
 * The legal text users accept at sign-up (TI-107): Terms of Use, Privacy Policy and Acceptable
 * Use Policy. The source is `docs/legal/*.md`; see `docs/legal/README.md` for the rules.
 *
 * The three documents are versioned together as one bundle, so one acceptance names one version.
 * Any change to any of them, even a typo, gets a new version here and in each file's header.
 * Earlier acceptances keep the version they were given, so we can always tell who agreed to
 * which text, and anyone whose latest acceptance isn't the current version is asked to accept the
 * new text the next time they open the app or portal (`TermsStatus`).
 */
export const CURRENT_TERMS_VERSION = '2026-11-draft.1';
export type CurrentTermsVersion = typeof CURRENT_TERMS_VERSION;

/**
 * Earlier versions a sign-up may still send. The apps build the version they show in, so when the
 * text changes, move the old version here: installed apps keep signing people up (under the text
 * they showed) until users update, and those accounts are then asked to accept the new text.
 * Remove a version once the app release with the new text has been out a few weeks.
 */
export const PREVIOUS_TERMS_VERSIONS: readonly string[] = [];

/** Versions a sign-up may send: the current one, then any still-accepted earlier ones. */
export const ACCEPTED_TERMS_VERSIONS: readonly string[] = [
  CURRENT_TERMS_VERSION,
  ...PREVIOUS_TERMS_VERSIONS,
];

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
 * The version a sign-up accepts: the current one, or an earlier one an installed app may still
 * show (`PREVIOUS_TERMS_VERSIONS`). Anything older gets a 400, so a stored acceptance always names
 * text a supported app could have shown.
 */
export const TermsVersion = z.string().refine((v) => ACCEPTED_TERMS_VERSIONS.includes(v), {
  error: `The terms have changed. Update the app, or reload the page, to read the current ${LEGAL_DOCUMENT_NAMES}.`,
});
export type TermsVersion = z.infer<typeof TermsVersion>;

/** Accepting the text again after it changed: only the current version will do. */
export const CurrentTermsVersionSchema = z.literal(CURRENT_TERMS_VERSION, {
  error: `The terms have changed. Update the app, or reload the page, to read the current ${LEGAL_DOCUMENT_NAMES}.`,
});

/**
 * Whether the signed-in account has accepted the current text (`GET /me/terms`). `accepted` is the
 * version of their latest acceptance. When `mustAccept` is true the apps show the new text and
 * nothing else until it is accepted (`AcceptTermsRequest`).
 */
export const TermsStatus = z.object({
  current: z.string(),
  accepted: z.string().nullable(),
  mustAccept: z.boolean(),
});
export type TermsStatus = z.infer<typeof TermsStatus>;

/** True when an account whose latest acceptance is `accepted` must accept the current text. */
export const mustAcceptTerms = (accepted: string | null) => accepted !== CURRENT_TERMS_VERSION;

/**
 * The flags an acceptance is stored under (`consent_records.flag`, append-only, with
 * `terms_version`). A teen's sign-up writes both: their own acceptance and their confirmation that
 * a parent or guardian agreed.
 */
export const CONSENT_FLAGS = { terms: 'terms', parentAgreed: 'parent_agreed' } as const;
export type ConsentFlag = (typeof CONSENT_FLAGS)[keyof typeof CONSENT_FLAGS];
