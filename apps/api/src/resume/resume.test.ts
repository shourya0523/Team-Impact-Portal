import { describe, expect, it } from 'vitest';
import { findDateRange, findGradYear, formatPeriod } from './dates';
import { isSensitiveLine, stripContacts } from './guardrails';
import { matchesType, readResume, readResumeText, resumeConfigFromEnv } from './index';
import { grounded } from './llm';
import { scoreReading, summarize } from './score';
import { buildScan } from './test/build-pdf';
import { CORPUS, longPdf } from './test/corpus';

const NOW = new Date('2026-10-30T12:00:00Z');
const pdf = (bytes: Uint8Array) => ({ bytes, mimeType: 'application/pdf', fileName: 'resume.pdf' });

describe('dates', () => {
  it.each([
    ['Jun 2024 – Aug 2024', 'Jun 2024 – Aug 2024'],
    ['January 2022 - Present', 'Jan 2022 – Present'],
    ['06/2024 to 08/2024', 'Jun 2024 – Aug 2024'],
    ['Summer 2025', 'Summer 2025'],
    ['Fall 2023 – Spring 2024', 'Fall 2023 – Spring 2024'],
    ['2021–22', '2021 – 2022'],
    ['2019 - 2023', '2019 – 2023'],
    ["Sept. '24 – current", 'Sep 2024 – Present'],
  ])('reads %s', (text, period) => {
    const range = findDateRange(`Analyst  ${text}  Boston, MA`);
    expect(range && formatPeriod(range)).toBe(period);
  });

  it('prefers an explicit graduation year over other years in the entry', () => {
    expect(findGradYear('B.A. Economics, Expected May 2027 (study abroad 2025)')).toEqual({
      year: 2027,
      explicit: true,
    });
    expect(findGradYear('Associate of Arts 2021 – 2022')).toEqual({ year: 2022, explicit: false });
    expect(findGradYear('Class of 2028')?.year).toBe(2028);
  });

  it('finds nothing in a line without dates', () => {
    expect(findDateRange('Analytics Intern, Lumen Logistics')).toBeNull();
  });
});

describe('guardrails', () => {
  it('never reads address or birthdate lines', () => {
    for (const line of [
      '12 Elm Street, Medford, MA 02155',
      'Address: Medford',
      'DOB: 01/01/2005',
      'Date of birth: 2005-01-01',
      'PO Box 44',
    ]) {
      expect(isSensitiveLine(line)).toBe(true);
    }
    for (const line of ['B.A. Economics, May 2026 West Hartford CT', 'Jun 2024 – Aug 2024']) {
      expect(isSensitiveLine(line)).toBe(false);
    }
  });

  it('strips contact details from text that leaves our servers', () => {
    const out = stripContacts('jordan.lee@example.edu | (617) 555-0142 | linkedin.com/in/jl');
    expect(out).toBe('[email] | [phone] | [link]');
  });

  it('checks the file starts the way its type says', () => {
    expect(matchesType(new TextEncoder().encode('%PDF-1.7'), 'application/pdf')).toBe(true);
    expect(matchesType(new TextEncoder().encode('<html>'), 'application/pdf')).toBe(false);
    expect(matchesType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
    expect(matchesType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/png')).toBe(false);
  });
});

describe('layout reader on the synthetic corpus', () => {
  it.each(CORPUS.map((c) => [c.name, c] as const))('%s', async (_, c) => {
    const reading = await readResume(pdf(await c.pdf()), {}, NOW);
    expect(reading.failed).toBe(false);
    expect(reading.method).toBe('layout');
    const score = scoreReading(reading.fields, c.gold);
    // Every field on the resume is right, and nothing is invented that isn't there.
    for (const [field, outcome] of Object.entries(score.fields)) {
      expect([field, outcome]).toEqual([field, expect.stringMatching(/^(correct|absent)$/)]);
    }
    expect(score.experience).toEqual({
      correct: c.gold.experience?.length ?? 0,
      wrong: 0,
      missing: 0,
      extra: 0,
    });
  });

  it('beats the TI-139 spike on every field it scored', async () => {
    const scores = await Promise.all(
      CORPUS.map(async (c) =>
        scoreReading((await readResume(pdf(await c.pdf()), {}, NOW)).fields, c.gold),
      ),
    );
    const s = summarize(scores);
    const rate = (f: { correct: number; present: number }) => f.correct / f.present;
    // Spike: name 89%, major 53%, grad year 77%, experience entries 88%.
    expect(rate(s.fields.firstName)).toBeGreaterThan(0.89);
    expect(rate(s.fields.major)).toBeGreaterThan(0.53);
    expect(rate(s.fields.classYear)).toBeGreaterThan(0.77);
    expect(rate(s.experience)).toBeGreaterThan(0.88);
  });

  it('keeps no address, birthdate or contact detail', async () => {
    const reading = await readResume(pdf(await CORPUS[0]!.pdf()), {}, NOW);
    const text = JSON.stringify(reading);
    for (const s of ['Elm Street', '02155', '2005-01-01', 'example.edu', '555-0142']) {
      expect(text).not.toContain(s);
    }
  });

  it('treats instructions in the resume as data', async () => {
    const c = CORPUS.find((x) => x.name === 'prompt-injection')!;
    const reading = await readResume(pdf(await c.pdf()), {}, NOW);
    expect(reading.fields.major).toBe('History');
    expect(reading.fields.classYear).toBe(2027);
  });

  it('flags major and year "Check" when several colleges could be meant', async () => {
    const c = CORPUS.find((x) => x.name === 'double-major-two-schools')!;
    const reading = await readResume(pdf(await c.pdf()), {}, NOW);
    expect(reading.check).toEqual(expect.arrayContaining(['major', 'classYear']));
    expect(reading.check).not.toContain('firstName');
  });

  it('reads pasted text with the same reader', async () => {
    const reading = await readResumeText(
      [
        'Sam Rivera',
        'Denver, CO',
        '',
        'EDUCATION',
        'University of Denver',
        'B.A. Finance  Class of 2027',
      ].join('\n'),
      {},
      NOW,
    );
    expect(reading.fields).toMatchObject({
      firstName: 'Sam',
      lastName: 'Rivera',
      city: 'Denver',
      region: 'west',
      major: 'Finance',
      classYear: 2027,
    });
  });
});

describe('failures fall back to typing the card in', () => {
  it('refuses more than three pages', async () => {
    expect(await readResume(pdf(await longPdf()), {}, NOW)).toMatchObject({
      failed: true,
      reason: 'too_many_pages',
    });
  });

  it('refuses a file whose bytes are not its declared type', async () => {
    const reading = await readResume(
      {
        bytes: new TextEncoder().encode('<html>hi</html>'),
        mimeType: 'application/pdf',
        fileName: 'x.pdf',
      },
      {},
      NOW,
    );
    expect(reading).toMatchObject({ failed: true, reason: 'wrong_file_type', fields: {} });
  });

  it('reports a damaged PDF as unreadable', async () => {
    const reading = await readResume(pdf(new TextEncoder().encode('%PDF-1.7 broken')), {}, NOW);
    expect(reading).toMatchObject({ failed: true, reason: 'unreadable' });
  });

  it('needs OCR for scans and photos, and says so when there is none', async () => {
    expect(await readResume(pdf(await buildScan()), {}, NOW)).toMatchObject({ reason: 'no_text' });
    const photo = {
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]),
      mimeType: 'image/jpeg',
      fileName: 'r.jpg',
    };
    expect(await readResume(photo, {}, NOW)).toMatchObject({
      failed: true,
      reason: 'ocr_unavailable',
    });
  });
});

describe('OCR through docling-serve', () => {
  const docling = {
    document: {
      json_content: {
        pages: { '1': { size: { width: 612, height: 792 } } },
        texts: [
          {
            label: 'title',
            text: 'Nia Brooks',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 760, r: 200, b: 740, coord_origin: 'BOTTOMLEFT' } },
            ],
          },
          {
            label: 'text',
            text: 'Seattle, WA | nia@example.com',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 735, r: 300, b: 725, coord_origin: 'BOTTOMLEFT' } },
            ],
          },
          {
            label: 'section_header',
            text: 'Education',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 700, r: 140, b: 688, coord_origin: 'BOTTOMLEFT' } },
            ],
          },
          {
            label: 'text',
            text: 'University of Washington',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 684, r: 260, b: 674, coord_origin: 'BOTTOMLEFT' } },
            ],
          },
          {
            label: 'text',
            text: 'B.S. Informatics, Expected June 2027',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 670, r: 300, b: 660, coord_origin: 'BOTTOMLEFT' } },
            ],
          },
          {
            label: 'text',
            text: '4410 W. Oak Ave, Apt 3',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 640, r: 300, b: 630, coord_origin: 'BOTTOMLEFT' } },
            ],
          },
        ],
      },
    },
  };

  it('reads a photo through the sidecar and the same layout reader', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(docling), { status: 200 });
    }) as unknown as typeof fetch;
    const photo = {
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]),
      mimeType: 'image/jpeg',
      fileName: 'r.jpg',
    };
    const reading = await readResume(
      photo,
      { docling: { url: 'http://docling:5001/', apiKey: 'k' }, fetch: fakeFetch },
      NOW,
    );
    expect(calls[0]!.url).toBe('http://docling:5001/v1/convert/file');
    expect((calls[0]!.init.headers as Record<string, string>)['X-Api-Key']).toBe('k');
    const form = calls[0]!.init.body as FormData;
    expect(form.get('to_formats')).toBe('json');
    expect(form.get('do_ocr')).toBe('true');
    expect(reading).toMatchObject({
      method: 'ocr',
      fields: {
        firstName: 'Nia',
        lastName: 'Brooks',
        city: 'Seattle',
        major: 'Informatics',
        classYear: 2027,
      },
    });
    expect(JSON.stringify(reading)).not.toContain('Oak Ave');
  });

  it('fails softly when the sidecar is down', async () => {
    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const photo = {
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      mimeType: 'image/jpeg',
      fileName: 'r.jpg',
    };
    expect(
      await readResume(photo, { docling: { url: 'http://docling' }, fetch: down }, NOW),
    ).toMatchObject({ failed: true, reason: 'ocr_failed' });
  });
});

describe('optional LLM pass', () => {
  const llmConfig = { apiKey: 'sk-test', model: 'gpt-4.1-mini', baseUrl: 'https://llm.test/v1' };
  const ref = (value: string | null, line: number | null) => ({ value, line });
  const answer = (overrides: Record<string, unknown>) => ({
    firstName: ref('Jordan', 0),
    lastName: ref('Lee', 0),
    homeCity: ref('Medford', 1),
    homeState: ref('MA', 1),
    position: ref(null, null),
    jerseyNumber: ref(null, null),
    lookingFor: ref(null, null),
    education: [],
    experience: [],
    skills: [],
    ...overrides,
  });
  const replying = (content: unknown, sink?: { body?: string }) =>
    (async (_url: string, init: RequestInit) => {
      if (sink) sink.body = String(init.body);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
        {
          status: 200,
        },
      );
    }) as unknown as typeof fetch;

  it('sends numbered lines without contacts, addresses or birthdates, and agrees with the layout reader', async () => {
    const sink: { body?: string } = {};
    const reading = await readResume(
      pdf(await CORPUS[0]!.pdf()),
      { llm: llmConfig, fetch: replying(answer({}), sink) },
      NOW,
    );
    expect(reading.method).toBe('layout+llm');
    expect(sink.body).toContain('L0');
    expect(sink.body).toContain('"strict":true');
    for (const s of ['example.edu', '555-0142', 'Elm Street', '2005-01-01'])
      expect(sink.body).not.toContain(s);
    expect(reading.fields.firstName).toBe('Jordan');
    expect(reading.check).not.toContain('firstName');
  });

  it('drops values the model cannot point to in the resume', async () => {
    const reading = await readResume(
      pdf(await CORPUS[0]!.pdf()),
      {
        llm: llmConfig,
        fetch: replying(answer({ firstName: ref('Maximilian', 0), homeCity: ref('Chicago', 1) })),
      },
      NOW,
    );
    // Not in line 0 or 1: the model's guesses never reach the athlete.
    expect(reading.fields.firstName).toBe('Jordan');
    expect(reading.fields.city).toBe('Medford');
  });

  it('flags a field "Check" when the two readers disagree', async () => {
    const c = CORPUS.find((x) => x.name === 'classic-single-column')!;
    const reading = await readResume(
      pdf(await c.pdf()),
      { llm: llmConfig, fetch: replying(answer({ lastName: ref('Medford', 1) })) },
      NOW,
    );
    expect(reading.check).toContain('lastName');
  });

  it('keeps the layout reading when the model call fails', async () => {
    const broken = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const reading = await readResume(
      pdf(await CORPUS[0]!.pdf()),
      { llm: llmConfig, fetch: broken },
      NOW,
    );
    expect(reading.method).toBe('layout');
    expect(reading.fields.lastName).toBe('Lee');
  });

  it('grounds by words, tolerating a wrapped line', () => {
    const line = (text: string) => ({
      text,
      x: 0,
      y: 0,
      fontSize: 10,
      bold: false,
      page: 1,
      segments: [text],
    });
    const lines = [line('Bachelor of Arts in Computer Science'), line('and Mathematics, May 2026')];
    expect(grounded('Computer Science and Mathematics', lines, 0)).toBe(true);
    expect(grounded('Astrophysics', lines, 0)).toBe(false);
  });

  it('is off unless explicitly turned on with a key', () => {
    expect(resumeConfigFromEnv({}).llm).toBeNull();
    expect(resumeConfigFromEnv({ RESUME_LLM: 'openai' }).llm).toBeNull();
    expect(resumeConfigFromEnv({ RESUME_LLM: 'openai', OPENAI_API_KEY: 'k' }).llm).toMatchObject({
      model: 'gpt-4.1-mini',
    });
  });
});
