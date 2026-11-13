# Resume reader (TI-113)

Turns an uploaded resume (PDF or photo) into Impact Card fields for the athlete to check. Nothing
it reads reaches the card, or anyone, until the athlete accepts it on the review screen (PRD §4).

```
PDF with text ─ pdf.js positioned text (pdf.ts) ─┐
photo / scan ─ docling-serve OCR (ocr.ts) ───────┴─ lines → sections → entries (layout.ts)
                                                     ├─ layout reader (heuristic.ts)  ──┐
                                                     └─ optional grounded LLM (llm.ts) ─┴─ merge → "Check" flags (index.ts)
```

## Why it is built this way

The TI-139 spike (Docling → gpt-4.1-mini on 20 real resumes) scored name 89%, school 56%, major 53%,
grad year 77%, experience entries 88%. Its findings drive the design:

| Spike finding                                                                             | What the reader does                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One school/major/year in the schema broke multi-degree resumes; "X and Y" majors were cut | Every degree in every education entry is read; the major is taken whole; major and class year always come from the same degree; several colleges flag both "Check" |
| Dates lost or swapped between neighbouring roles                                          | Dates are only looked for inside one entry's own header lines (`toEntries`, `readEntry`)                                                                           |
| Required fields made the model invent values                                              | Nothing is required; a field with no candidate scoring above zero is left empty; LLM fields are all nullable                                                       |
| Home city taken from the school's location                                                | City and region are only read from the header (profile section)                                                                                                    |
| Styling lost in markdown (coloured company read as a title, light name missed)            | Born-digital PDFs never go through Docling: pdf.js gives font size and weight per run, and light text is still text                                                |
| Courses under "Awards" counted as honours                                                 | Coursework and certifications are their own section (the card has no honours field)                                                                                |

Approaches it borrows, all re-implemented (no copied code):

- **open-resume** (github.com/xitanggg/open-resume, AGPL): text items → lines → sections → feature
  scoring with positive and negative weights; entries split at gaps over 1.4× the usual line gap.
  Added here: two-column reading order, a heading dictionary, several degrees per entry, season
  and "Present" dates, athlete fields.
- **SmartResume** (github.com/alibaba/SmartResume, arXiv 2510.09722): the LLM sees numbered lines,
  must cite the lines each value came from, and any value not found in its lines is dropped. Dates
  are re-read from the cited lines by our own parser. Their reported F1 gain from this pipeline:
  0.919 → 0.959 (their data, not ours).
- **Resume-Matcher** (github.com/srbhr/Resume-Matcher): heading aliases and prompt rules (null for
  missing, keep overlapping roles separate).
- **docling-serve** (github.com/docling-project/docling-serve, MIT): OCR for photos and scans only.

## Settings

| Variable           | Default        | Effect                                                                           |
| ------------------ | -------------- | -------------------------------------------------------------------------------- |
| `DOCLING_URL`      | unset          | docling-serve for photos and scans. Unset: those fall back to typing the card in |
| `DOCLING_API_KEY`  | unset          | Sent as `X-Api-Key` when the sidecar requires it                                 |
| `RESUME_LLM`       | `off`          | `openai` adds the grounded LLM pass (needs `OPENAI_API_KEY`)                     |
| `RESUME_LLM_MODEL` | `gpt-4.1-mini` | The spike's model                                                                |

The LLM pass sends resume text, with emails, phone numbers and links replaced and address and
birthdate lines already removed, to OpenAI. It stays off unless Team Impact opts in (TI-155: "no
additional AI company sees resumes"), and the privacy policy draft names it as a processor.

## Guardrails

- The file is only held in memory for the request; it is never written anywhere.
- The first bytes must match the declared type; over 3 pages or 5 MB is refused.
- Those caps don't bound how far a PDF unpacks (a 120 KB file can hold a million text runs), so
  pdf.js runs in a worker thread (`pdf-worker.mjs`), never on the API's event loop. A resume is
  refused as unreadable when it has more text than any real one (30,000 runs), takes over 10 s,
  or grows the process by over 384 MB; the worker is then replaced. Limits are in `PDF_LIMITS`
  (`pdf.ts`), and `pdf-limits.test.ts` checks each one with a compression bomb.
- One PDF is read at a time per instance, with up to 32 waiting; past that, and past 10 uploads
  per athlete per hour, the upload answers 429 so the app can retry.
- Lines with an address or birthdate are dropped before any reader sees them (`isSensitiveLine`).
  A birthdate is a labelled one ("DOB", "born"), any ISO day, or a single unlabelled day in any
  common format ("03/14/2004", "14.03.2004", "March 14, 2004", "14 March 2004") whose year makes
  the person at least 13. Days that are one end of a range ("06/01/2022 – 08/31/2022"), are named
  as another event ("Graduated 05/15/2010") or are too recent don't drop the line; month-and-year
  dates ("Aug 2022", "06/2022") are never days.
- Before the LLM pass, `stripContacts` replaces emails, phone numbers (US, `+` with 8–15 digits,
  and national numbers of 10–15 digits that aren't just years), links (`https://`, `www.`, any
  `domain.tld/path`, and lowercase bare domains with common endings), `@handles` and any
  birthdate-like day left over. Skill names that look like domains (`Node.js`, `ASP.NET`), degree
  abbreviations, GPAs, stats and year ranges are kept. An `@Acme` written as "at Acme" is stripped
  as a handle.
- Every value is validated against the card schema (`CardFields`); text is plain, no markup.
- Text that looks like instructions is data: the layout reader can't follow it, and the LLM's output
  is schema-checked and grounded, so it can only return words that are in the resume.

## Measuring it

```bash
pnpm --filter @team-impact/api test src/resume          # unit + corpus + route tests
pnpm --filter @team-impact/api resume:eval --corpus     # report on the synthetic resumes
pnpm --filter @team-impact/api resume:eval ~/resumes    # report on real resumes, kept locally
RESUME_LLM=openai OPENAI_API_KEY=… pnpm --filter @team-impact/api resume:eval ~/resumes
```

The synthetic corpus (`test/corpus.ts`) is built to cover the spike's failure modes, so its 100%
says the reader handles them, not how it does on real resumes. Re-run the spike's set (with
permission, kept off the repo) and compare against the table above before the pilot. See
`docs/testing/TI-113.md`.
