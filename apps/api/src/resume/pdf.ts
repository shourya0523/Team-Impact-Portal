import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RESUME_UPLOAD_LIMITS } from '@team-impact/contracts';
import type { TextItem } from './types';

export class ResumeReadError extends Error {
  constructor(
    readonly reason: 'too_many_pages' | 'unreadable' | 'no_text' | 'ocr_unavailable' | 'ocr_failed',
  ) {
    super(reason);
  }
}

/** pdf.js's own metrics for the 14 standard fonts, so text in them measures right without a warning. */
const standardFontDataUrl = (() => {
  const pkg = createRequire(import.meta.url).resolve('pdfjs-dist/package.json');
  return pathToFileURL(join(dirname(pkg), 'standard_fonts') + '/').href;
})();

const BOLD_FONT = /bold|black|heavy|semibold|demi/i;

/** Below this many characters a PDF is a scan with no text layer, and needs OCR. */
export const MIN_TEXT_CHARS = 40;

/**
 * Positioned text from a born-digital PDF, with font size and weight per run (pdf.js's legacy
 * build runs in Node without a worker or canvas). Styling is the strongest layout signal, and the
 * spike lost it by converting to markdown first (TI-139 finding 6). Capped at
 * `RESUME_UPLOAD_LIMITS.maxPages`.
 */
export const readPdf = async (
  bytes: Uint8Array,
): Promise<{ items: TextItem[]; pageWidth: number }> => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let pdf;
  try {
    pdf = await getDocument({
      data: new Uint8Array(bytes),
      standardFontDataUrl,
      fontExtraProperties: true,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    }).promise;
  } catch {
    // Damaged, password-protected, or not a PDF at all.
    throw new ResumeReadError('unreadable');
  }
  try {
    if (pdf.numPages > RESUME_UPLOAD_LIMITS.maxPages) throw new ResumeReadError('too_many_pages');
    const items: TextItem[] = [];
    let offset = 0;
    let pageWidth = 612;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const { width, height } = page.getViewport({ scale: 1 });
      if (n === 1) pageWidth = width;
      const content = await page.getTextContent();
      // Fonts are only resolved once the page's operators are loaded.
      await page.getOperatorList();
      for (const raw of content.items) {
        if (!('str' in raw) || raw.str.trim() === '') continue;
        const [a, b, , d, e, f] = raw.transform as number[];
        const fontSize = Math.hypot(b!, d!) || raw.height || Math.abs(a!);
        const font = page.commonObjs.has(raw.fontName)
          ? (page.commonObjs.get(raw.fontName) as { name?: string; bold?: boolean } | null)
          : null;
        items.push({
          text: raw.str,
          x: e!,
          y: offset + height - f! - fontSize,
          width: raw.width,
          fontSize: Math.round(fontSize * 10) / 10,
          bold: Boolean(font?.bold) || BOLD_FONT.test(font?.name ?? ''),
          page: n,
        });
      }
      offset += height;
      page.cleanup();
    }
    return { items, pageWidth };
  } finally {
    await pdf.destroy();
  }
};
