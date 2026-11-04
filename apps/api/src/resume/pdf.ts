import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { RESUME_UPLOAD_LIMITS } from '@team-impact/contracts';
import type { TextItem } from './types';

export class ResumeReadError extends Error {
  constructor(
    readonly reason:
      'too_many_pages' | 'unreadable' | 'no_text' | 'ocr_unavailable' | 'ocr_failed' | 'busy',
  ) {
    super(reason);
  }
}

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
/** pdf.js's own metrics for the 14 standard fonts, so text in them measures right without a warning. */
const standardFontDataUrl = pathToFileURL(join(pdfjsRoot, 'standard_fonts') + '/').href;
/** pdf.js's legacy build runs in Node without a canvas. */
const pdfjsUrl = pathToFileURL(join(pdfjsRoot, 'legacy/build/pdf.mjs')).href;
/** Next to this file in src/, and next to server.js in dist/ (build.mjs copies it). */
const WORKER_URL = new URL('./pdf-worker.mjs', import.meta.url);

/** Below this many characters a PDF is a scan with no text layer, and needs OCR. */
export const MIN_TEXT_CHARS = 40;

/**
 * What one PDF may cost. The upload caps (5 MB, 3 pages) don't bound how far a PDF unpacks: a
 * 120 KB file can hold a million text runs and take 20 s and 1.3 GB to read. So pdf.js runs in a
 * worker thread that is killed when it runs too long or grows too big, and a resume with more
 * text than any real one is refused before it is read in full.
 */
export interface PdfLimits {
  /** Wall-clock time for one PDF, once pdf.js has loaded. Real resumes take tens of ms. */
  timeoutMs: number;
  /** The worker's JavaScript heap. */
  heapMb: number;
  /**
   * Growth of the whole process while one PDF is read (pdf.js loading isn't counted). Decoded
   * streams live outside the JS heap, so the heap cap alone doesn't bound them. Real resumes
   * add a few MB.
   */
  memoryMb: number;
  /** Text runs across all pages. A dense three-page resume has a few thousand. */
  maxItems: number;
  /** PDFs read at once on this instance; later uploads wait their turn. */
  concurrency: number;
  /**
   * Uploads that may wait for a turn (a warm read takes tens of ms, so a burst clears fast).
   * Beyond that the API answers "busy, try again".
   */
  maxWaiting: number;
}

export const PDF_LIMITS: PdfLimits = {
  timeoutMs: 10_000,
  heapMb: 256,
  memoryMb: 384,
  maxItems: 30_000,
  concurrency: 1,
  maxWaiting: 32,
};

type WorkerResult =
  | { ok: true; items: TextItem[]; pageWidth: number }
  | { ok: false; reason: 'unreadable' | 'too_many_pages' | 'too_complex' };

/** One PDF at a time per instance (by default), so two uploads can't double the worst case. */
class Turns {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  async take(limits: PdfLimits): Promise<() => void> {
    if (this.running >= limits.concurrency) {
      if (this.waiting.length >= limits.maxWaiting) throw new ResumeReadError('busy');
      // The turn is handed over by the release below, so `running` stays the same.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.running++;
    }
    return () => {
      const next = this.waiting.shift();
      if (next) next();
      else this.running--;
    };
  }
}
const turns = new Turns();

/**
 * One pdf.js worker, kept warm between resumes (loading pdf.js takes a second or more). It is
 * replaced after any resume that had to be stopped, since that one may have left it bloated.
 */
let current: { worker: Worker; heapMb: number; ready: Promise<void> } | null = null;
let nextJob = 0;

const workerFor = (limits: PdfLimits) => {
  if (current && current.heapMb === limits.heapMb) return current;
  if (current) void current.worker.terminate();
  const worker = new Worker(WORKER_URL, {
    workerData: { pdfjsUrl, standardFontDataUrl },
    resourceLimits: { maxOldGenerationSizeMb: limits.heapMb, maxYoungGenerationSizeMb: 32 },
  });
  // An idle reader never keeps the process (or a test run) alive. (Piping its stdout/stderr
  // would; pdf.js runs with verbosity 0, so it has nothing to say.)
  worker.unref();
  // Resolves once pdf.js has loaded (a second or so), or the worker died trying.
  const ready = new Promise<void>((resolve) => {
    const onReady = (message: { ready?: boolean }) => {
      if (!message.ready) return;
      worker.off('message', onReady);
      resolve();
    };
    worker.on('message', onReady);
    worker.once('exit', () => resolve());
  });
  const entry = { worker, heapMb: limits.heapMb, ready };
  worker.once('exit', () => {
    if (current === entry) current = null;
  });
  current = entry;
  return entry;
};

const runWorker = async (bytes: Uint8Array, limits: PdfLimits) => {
  const { worker, ready } = workerFor(limits);
  await ready;
  // It died loading pdf.js: nothing to read with.
  if (current?.worker !== worker) return { ok: false, reason: 'unreadable' } as WorkerResult;
  return new Promise<WorkerResult>((resolve) => {
    const id = ++nextJob;
    const startRss = process.memoryUsage.rss();
    let settled = false;
    const finish = (result: WorkerResult, stopWorker: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearInterval(watch);
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
      if (stopWorker) {
        // Forget it now: its exit event comes later, and the next resume must get a fresh one.
        if (current?.worker === worker) current = null;
        void worker.terminate();
      }
      resolve(result);
    };
    // Running out of time or memory means the file is built to be expensive, not that it's a resume.
    const tooComplex = () => finish({ ok: false, reason: 'too_complex' }, true);
    const onMessage = (message: WorkerResult & { id: number }) => {
      if (message.id !== id) return;
      // A file refused for its size may still have left the worker bloated: start a fresh one.
      finish(message, !message.ok && message.reason === 'too_complex');
    };
    // Includes ERR_WORKER_OUT_OF_MEMORY when the heap cap is hit.
    const onError = tooComplex;
    const onExit = () => finish({ ok: false, reason: 'unreadable' }, false);
    const deadline = setTimeout(tooComplex, limits.timeoutMs);
    const watch = setInterval(() => {
      if (process.memoryUsage.rss() - startRss > limits.memoryMb * 2 ** 20) tooComplex();
    }, 25);
    worker.on('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage({
      id,
      bytes: new Uint8Array(bytes),
      maxPages: RESUME_UPLOAD_LIMITS.maxPages,
      maxItems: limits.maxItems,
    });
  });
};

/**
 * Positioned text from a born-digital PDF, with font size and weight per run. Styling is the
 * strongest layout signal, and the spike lost it by converting to markdown first (TI-139
 * finding 6). Capped at `RESUME_UPLOAD_LIMITS.maxPages`, and at `limits` (see `PdfLimits`).
 */
export const readPdf = async (
  bytes: Uint8Array,
  limits: PdfLimits = PDF_LIMITS,
): Promise<{ items: TextItem[]; pageWidth: number }> => {
  const release = await turns.take(limits);
  try {
    const result = await runWorker(bytes, limits);
    if (result.ok) return { items: result.items, pageWidth: result.pageWidth };
    if (result.reason === 'too_many_pages') throw new ResumeReadError('too_many_pages');
    // Too complex reads, to the athlete, like any other file we can't read: type the card in.
    throw new ResumeReadError('unreadable');
  } finally {
    release();
  }
};
