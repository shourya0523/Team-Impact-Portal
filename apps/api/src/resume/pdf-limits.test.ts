// A resume is untrusted input, and a small PDF can unpack into gigabytes of content. These check
// that such a file is refused quickly, inside its limits, without stalling the API.
import { deflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { readResume } from './index';
import { PDF_LIMITS, readPdf, ResumeReadError } from './pdf';
import { CORPUS } from './test/corpus';

// pdf.js loads on first use (2–3 s alone, more on a busy CI runner).
vi.setConfig({ testTimeout: 30_000 });

const TEXT_RUN = 'BT /F1 9 Tf 72 700 Td (Experience) Tj ET\n';
const DRAWING = '0 0 m 1 1 l S\n';

/** A one-page PDF whose content stream, `op` repeated, unpacks to `mb` megabytes. */
const bombPdf = (op: string, mb: number): Uint8Array => {
  const stream = deflateSync(Buffer.alloc(mb * 2 ** 20, op), { level: 9 });
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),
      stream,
      Buffer.from('\nendstream'),
    ]),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  const offsets: number[] = [];
  let length = parts[0]!.length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const part = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      Buffer.from(body),
      Buffer.from('\nendobj\n'),
    ]);
    parts.push(part);
    length += part.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  return new Uint8Array(Buffer.concat([...parts, Buffer.from(xref)]));
};

/** Runs `work` and reports the longest the event loop went without a turn meanwhile. */
const longestStall = async <T>(work: () => Promise<T>) => {
  let longest = 0;
  let last = performance.now();
  const tick = setInterval(() => {
    const now = performance.now();
    longest = Math.max(longest, now - last - 20);
    last = now;
  }, 20);
  try {
    return { result: await work(), longest };
  } finally {
    clearInterval(tick);
  }
};

const realResume = () => CORPUS.find((c) => c.name === 'classic-single-column')!.pdf();
/** 200 MB of drawing and no text, so only the clock or the memory cap can stop it. Built once. */
let drawingBomb: Uint8Array | undefined;
const slowPdf = () => (drawingBomb ??= bombPdf(DRAWING, 200));

describe('PDF limits', () => {
  it('still reads a real resume, quickly once pdf.js is warm', async () => {
    const bytes = await realResume();
    await readPdf(bytes);
    const started = performance.now();
    const { items } = await readPdf(bytes);
    expect(items.length).toBeGreaterThan(10);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('refuses a small PDF with more text than any resume, without stalling the API', async () => {
    // 120 KB on disk, a million text runs unpacked: 20 s and 1.3 GB in the old in-process reader.
    const bytes = bombPdf(TEXT_RUN, 40);
    expect(bytes.byteLength).toBeLessThan(200_000);
    const started = performance.now();
    const { result, longest } = await longestStall(() =>
      readResume({ bytes, mimeType: 'application/pdf', fileName: 'r.pdf' }),
    );
    expect(result).toMatchObject({ failed: true, reason: 'unreadable' });
    expect(performance.now() - started).toBeLessThan(10_000);
    expect(longest).toBeLessThan(500);
  });

  it('stops a PDF that takes too long to read', async () => {
    const bytes = slowPdf();
    const started = performance.now();
    await expect(
      readPdf(bytes, { ...PDF_LIMITS, timeoutMs: 300, memoryMb: 16_384 }),
    ).rejects.toMatchObject({ reason: 'unreadable' });
    // Generous: a fresh worker loads pdf.js first, which isn't on the clock.
    expect(performance.now() - started).toBeLessThan(8_000);
  });

  it('stops a PDF that grows too big to read', async () => {
    const bytes = slowPdf();
    const started = performance.now();
    await expect(
      readPdf(bytes, { ...PDF_LIMITS, timeoutMs: 60_000, memoryMb: 64 }),
    ).rejects.toMatchObject({ reason: 'unreadable' });
    expect(performance.now() - started).toBeLessThan(20_000);
  });

  it('reads one PDF at a time and turns uploads away when too many are waiting', async () => {
    const limits = { ...PDF_LIMITS, timeoutMs: 1_000, memoryMb: 16_384, maxWaiting: 1 };
    const slow = slowPdf();
    const first = readPdf(slow, limits);
    const second = readPdf(await realResume(), limits);
    const third = readPdf(await realResume(), limits);
    await expect(third).rejects.toEqual(new ResumeReadError('busy'));
    await expect(first).rejects.toMatchObject({ reason: 'unreadable' });
    // The waiting one runs once the first is stopped, on a fresh worker.
    expect((await second).items.length).toBeGreaterThan(10);
  });

  it('reports a busy reader so the upload can be retried', async () => {
    const resume = { bytes: await realResume(), mimeType: 'application/pdf', fileName: 'r.pdf' };
    const first = readPdf(slowPdf(), { ...PDF_LIMITS, timeoutMs: 1_000, memoryMb: 16_384 });
    // readResume uses the default limits: fill the queue behind the slow one, then one more.
    const waiting = Array.from({ length: PDF_LIMITS.maxWaiting }, () => readResume(resume));
    expect(await readResume(resume)).toMatchObject({ failed: true, reason: 'busy' });
    await expect(first).rejects.toMatchObject({ reason: 'unreadable' });
    for (const reading of await Promise.all(waiting)) expect(reading.failed).toBe(false);
  });
});
