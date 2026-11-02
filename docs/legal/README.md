# Legal documents

The text users accept when they sign up (TI-107). **All three are drafts for Team Impact's counsel, not legal advice.**

| Document              | File                                           | In code                             |
| --------------------- | ---------------------------------------------- | ----------------------------------- |
| Terms of Use          | [terms.md](terms.md)                           | `LEGAL_DOCUMENTS.terms`             |
| Privacy Policy        | [privacy.md](privacy.md)                       | `LEGAL_DOCUMENTS.privacy`           |
| Acceptable Use Policy | [acceptable-use.md](acceptable-use.md)         | `LEGAL_DOCUMENTS['acceptable-use']` |
| Cover note to counsel | [counsel-cover-note.md](counsel-cover-note.md) | (not accepted by users)             |

The code side lives in `packages/contracts/src/legal.ts`.

## Versioning rules

1. **The three documents share one version**, `CURRENT_TERMS_VERSION`, because users accept them together. One acceptance names one version.
2. **Any change to any of the three gets a new version**, even a typo fix. Change it in four places in the same commit: `CURRENT_TERMS_VERSION` in `packages/contracts/src/legal.ts` and the `**Version:**` line at the top of each document. A test (`apps/api/src/test/legal-docs.test.ts`) fails if they disagree.
3. **Version format:** `YYYY-MM` of the intended effective month, then `-draft.N` while counsel is reviewing (`2026-11-draft.1`, `2026-11-draft.2`, …). The version counsel approves drops the suffix (`2026-11`). A later change in the same month adds `.N` (`2026-11.1`).
4. **Status:** while a version ends in `-draft.N`, each header says `DRAFT — NOT LEGAL ADVICE, pending Team Impact counsel` and `LEGAL_STATUS` is `'draft'`. When counsel approves, set `LEGAL_STATUS` to `'final'` and replace the status line with the approval date. Don't submit an App Store build while `LEGAL_STATUS` is `'draft'`.
5. **Never edit an accepted version in place.** Git history is the archive of every version's exact text; tag the commit that makes a version final (`legal/2026-11`).

## How acceptance is recorded

- Sign-up requests carry `acceptTerms: true` and `termsVersion`. The contract (`TermsVersion`, a `z.literal`) only accepts the current version, so a client showing old text gets a 400 and must reload. This covers open sign-up (`SignupRequest`), recruiter sign-up (`RecruiterSignupRequest`) and a new coach accepting an invite (`AcceptCoachInviteRequest.newAccount`).
- Teens (13–17) must also send `parentAgreed: true`, confirming a parent or guardian agreed (Terms §3). The contract and the API both refuse a teen sign-up without it.
- The API stores each acceptance as an append-only `consent_records` row: `flag = 'terms'` (and `'parent_agreed'` for a teen), `value = true`, `terms_version` = the accepted version, and the time. The mock API keeps the same rows in `world.signup.consents`. A recruiter's acceptance is kept with their pending sign-up and recorded when staff approve the account.
- The seed's fixture users carry `terms_version = 'v2.0'`, an older label from before this scheme; it is test data, not an accepted text.

## When the version changes

Existing users accepted an older version. Asking them to accept the new one (on next sign-in, and blocking use until they do for material changes) is the real auth layer's job and isn't built yet. Their old `consent_records` rows stay; the new acceptance is a new row.

## Where users read the documents

The app and portal sign-up screens name the three documents and show the version being accepted. **Public copies are not hosted yet**: before the November App Store submission the final text needs a public URL (Apple requires a privacy policy link in App Store Connect and inside the app). Decide where they live (for example the portal at `/legal/terms`, or teamimpact.org) and add the links.
