import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_TERMS_VERSION,
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENTS,
  LEGAL_STATUS,
} from '@team-impact/contracts';

// TI-107: the legal text users accept lives in docs/legal and is versioned with the contract.
// These checks keep the files and `CURRENT_TERMS_VERSION` in step, and keep the clauses the
// ticket requires from being dropped by accident. They are no substitute for counsel's review.

const repoFile = (path: string) =>
  readFile(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const doc = (id: (typeof LEGAL_DOCUMENT_IDS)[number]) => repoFile(LEGAL_DOCUMENTS[id].source);

describe('legal documents', () => {
  it('names the current version in every document header', async () => {
    for (const id of LEGAL_DOCUMENT_IDS) {
      const text = await doc(id);
      const version = /^> \*\*Version:\*\* (\S+)$/m.exec(text)?.[1];
      expect(version, `${LEGAL_DOCUMENTS[id].source}: bump it with CURRENT_TERMS_VERSION`).toBe(
        CURRENT_TERMS_VERSION,
      );
      expect(text.startsWith('# '), id).toBe(true);
    }
  });

  it('marks drafts as drafts, and only drafts', async () => {
    const draft = CURRENT_TERMS_VERSION.includes('-draft.');
    expect(LEGAL_STATUS).toBe(draft ? 'draft' : 'final');
    for (const id of LEGAL_DOCUMENT_IDS) {
      const text = await doc(id);
      expect(text.includes('DRAFT — NOT LEGAL ADVICE'), id).toBe(draft);
    }
  });

  it('keeps the clauses TI-107 requires', async () => {
    const terms = await doc('terms');
    const privacy = await doc('privacy');
    const aup = await doc('acceptable-use');
    // Teens confirm a parent or guardian agreed.
    expect(terms).toMatch(/13 to 17[\s\S]*parent or legal guardian[\s\S]*agreed/);
    // Contacts shared with families and recruiters, identity-search opt-in, 30-day deletion.
    expect(privacy).toMatch(/contact details for families/i);
    expect(privacy).toMatch(/contact details for recruiters/i);
    expect(privacy).toMatch(/identity search/i);
    expect(privacy).toMatch(/two separate choices/);
    expect(privacy).toMatch(/Every identity search is logged/);
    expect(privacy).toMatch(/30 days/);
    expect(privacy).toMatch(/don't collect health or diagnosis information/);
    // Harassment, contact misuse, impersonation; report and block.
    expect(aup).toMatch(/no harassment/i);
    expect(aup).toMatch(/contact details only for what they were shared for/i);
    expect(aup).toMatch(/no impersonation/i);
    expect(aup).toMatch(/## Report and block/);
  });

  it('sends counsel all five PRD §11 questions', async () => {
    const note = await repoFile('docs/legal/counsel-cover-note.md');
    const rows = note.split('\n').filter((line) => /^\| [1-5] +\|/.test(line));
    expect(rows).toHaveLength(5);
    expect(note).toContain(CURRENT_TERMS_VERSION);
  });
});
