// Runs pdf.js on resumes, off the API's main thread (see pdf.ts). One worker lives for many
// resumes, so pdf.js loads once; pdf.ts kills it and starts another when a file costs too much.
// Plain JavaScript so the same file runs under tsx, vitest and the production bundle without a
// TypeScript loader: build.mjs copies it next to dist/server.js.
//
// A resume is untrusted input. A small PDF can unpack into gigabytes of content and millions of
// text runs, so this worker stops reading once the text is longer than any real resume, and pdf.ts
// caps its memory and kills it at a deadline.
import { parentPort, workerData } from 'node:worker_threads';

/**
 * @typedef {{ text: string, x: number, y: number, width: number, fontSize: number, bold: boolean, page: number }} TextItem
 * @typedef {{ id: number, bytes: Uint8Array, maxPages: number, maxItems: number }} Job
 */

const { pdfjsUrl, standardFontDataUrl } =
  /** @type {{ pdfjsUrl: string, standardFontDataUrl: string }} */ (workerData);
const pdfjs = import(pdfjsUrl);
// pdf.ts starts each resume's clock and memory budget only once pdf.js has loaded.
void pdfjs.finally(() => parentPort?.postMessage({ ready: true }));

const BOLD_FONT = /bold|black|heavy|semibold|demi/i;

/** @param {Job} job */
const read = async ({ bytes, maxPages, maxItems }) => {
  const { getDocument } = await pdfjs;
  let pdf;
  try {
    pdf = await getDocument({
      data: bytes,
      standardFontDataUrl,
      fontExtraProperties: true,
      disableFontFace: true,
      useSystemFonts: false,
      // Text is all we read: never decode an image, however large it claims to be.
      maxImageSize: 0,
      verbosity: 0,
    }).promise;
  } catch {
    // Damaged, password-protected, or not a PDF at all.
    return { ok: false, reason: 'unreadable' };
  }
  let abandoned = false;
  try {
    if (pdf.numPages > maxPages) return { ok: false, reason: 'too_many_pages' };
    /** @type {TextItem[]} */
    const items = [];
    let runs = 0;
    let offset = 0;
    let pageWidth = 612;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const { width, height } = page.getViewport({ scale: 1 });
      if (n === 1) pageWidth = width;
      // Streamed, so a page with millions of text runs is abandoned at the cap instead of being
      // read in full (getTextContent() would collect every run first).
      const raw = [];
      const reader = page.streamTextContent().getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        runs += value.items.length;
        if (runs > maxItems) {
          // Don't wait for pdf.js to wind down (it can take as long as reading the rest):
          // pdf.ts answers the upload and replaces this worker.
          abandoned = true;
          void reader.cancel();
          return { ok: false, reason: 'too_complex' };
        }
        raw.push(...value.items);
      }
      // Fonts are only resolved once the page's operators are loaded.
      await page.getOperatorList();
      for (const run of raw) {
        if (!('str' in run) || run.str.trim() === '') continue;
        const [a, b, , d, e, f] = run.transform;
        const fontSize = Math.hypot(b, d) || run.height || Math.abs(a);
        const font = page.commonObjs.has(run.fontName) ? page.commonObjs.get(run.fontName) : null;
        items.push({
          text: run.str,
          x: e,
          y: offset + height - f - fontSize,
          width: run.width,
          fontSize: Math.round(fontSize * 10) / 10,
          bold: Boolean(font?.bold) || BOLD_FONT.test(font?.name ?? ''),
          page: n,
        });
      }
      offset += height;
      page.cleanup();
    }
    return { ok: true, items, pageWidth };
  } finally {
    if (!abandoned) await pdf.destroy();
  }
};

parentPort?.on('message', (/** @type {Job} */ job) => {
  read(job).then(
    (result) => parentPort?.postMessage({ id: job.id, ...result }),
    () => parentPort?.postMessage({ id: job.id, ok: false, reason: 'unreadable' }),
  );
});
