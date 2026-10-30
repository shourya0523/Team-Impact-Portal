import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Builds test resumes as real PDFs, so tests exercise pdf.js, fonts and layout the way an upload
 * does. Nothing here is a real person's resume; no resume files are committed (TI-139 rule).
 */
export interface Row {
  text: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  /** Left edge. Defaults to the column's left margin. */
  x?: number;
  /** Indent from the column's left margin (bullets). */
  indent?: number;
  /** Text drawn right-aligned on the same line (dates, locations). */
  right?: string;
  /** Extra space above the row, in points. */
  gap?: number;
  /** White text on a dark band (a styled header). */
  inverse?: boolean;
}

export interface Column {
  x: number;
  width: number;
  rows: Row[];
  /** Where the column starts, from the top of the page. */
  top?: number;
}

const PAGE = { width: 612, height: 792 };

export const buildPdf = async (pages: Column[][]): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  for (const columns of pages) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    for (const col of columns) {
      let y = PAGE.height - (col.top ?? 48);
      for (const row of col.rows) {
        const size = row.size ?? 10;
        y -= (row.gap ?? 0) + size * 1.35;
        const font = row.bold ? fonts.bold : row.italic ? fonts.italic : fonts.regular;
        if (row.inverse) {
          page.drawRectangle({
            x: col.x - 6,
            y: y - 4,
            width: col.width + 12,
            height: size + 10,
            color: rgb(0.1, 0.15, 0.3),
          });
        }
        const color = row.inverse ? rgb(1, 1, 1) : rgb(0, 0, 0);
        page.drawText(row.text, { x: row.x ?? col.x + (row.indent ?? 0), y, size, font, color });
        if (row.right) {
          const w = fonts.regular.widthOfTextAtSize(row.right, size);
          page.drawText(row.right, {
            x: col.x + col.width - w,
            y,
            size,
            font: fonts.regular,
            color,
          });
        }
      }
    }
  }
  return doc.save();
};

/** A page with no text layer at all, like a scan. */
export const buildScan = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 40, y: 40, width: 500, height: 700, color: rgb(0.9, 0.9, 0.9) });
  return doc.save();
};

export const single = (rows: Row[]): Column[][] => [[{ x: 54, width: 504, rows }]];
