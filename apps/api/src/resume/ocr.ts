import { z } from 'zod';
import { clean, isSensitiveLine } from './guardrails';
import { ResumeReadError } from './pdf';
import type { Line } from './types';

/**
 * Phone photos and scanned PDFs have no text layer, so they go to a docling-serve sidecar
 * (github.com/docling-project/docling-serve, MIT): one stateless container, which the build-vs-buy
 * rule allows us to run ourselves. Docling is Python, so it can't run in-process in the Node API
 * as Stack decisions §3 first assumed. Born-digital PDFs never go here: Docling's output loses
 * bold and font size, which the layout reader depends on.
 */
export interface DoclingConfig {
  url: string;
  apiKey?: string;
  timeoutMs?: number;
}

const Bbox = z.object({
  l: z.number(),
  t: z.number(),
  r: z.number(),
  b: z.number(),
  coord_origin: z.string().optional(),
});

const DoclingResponse = z.object({
  document: z.object({
    json_content: z
      .object({
        texts: z.array(
          z.object({
            label: z.string(),
            text: z.string(),
            prov: z.array(z.object({ page_no: z.number(), bbox: Bbox })).default([]),
          }),
        ),
        pages: z
          .record(
            z.string(),
            z.object({ size: z.object({ width: z.number(), height: z.number() }) }),
          )
          .default({}),
      })
      .nullable(),
  }),
});

/** Font sizes stand in for Docling's labels, which is what the layout reader looks at. */
const SIZE_BY_LABEL: Record<string, number> = { title: 20, section_header: 13 };

export const doclingToLines = (
  json: z.infer<typeof DoclingResponse>['document']['json_content'],
) => {
  if (!json) return { lines: [] as Line[], pageWidth: 612 };
  const pageWidth = Object.values(json.pages)[0]?.size.width ?? 612;
  const heights = new Map(Object.entries(json.pages).map(([k, v]) => [Number(k), v.size.height]));
  let lines: Line[] = json.texts.flatMap((t) => {
    const prov = t.prov[0];
    const text = clean(t.text);
    if (!text || !prov) return [];
    const pageHeight = heights.get(prov.page_no) ?? 792;
    const top = prov.bbox.coord_origin === 'BOTTOMLEFT' ? pageHeight - prov.bbox.t : prov.bbox.t;
    const offset = [...heights.entries()]
      .filter(([page]) => page < prov.page_no)
      .reduce((sum, [, h]) => sum + h, 0);
    const heading = t.label === 'section_header' || t.label === 'title';
    const display = t.label === 'list_item' && !/^[•●▪■◦*–-]/.test(text) ? `• ${text}` : text;
    return [
      {
        text: display,
        x: prov.bbox.l,
        y: offset + top,
        fontSize: SIZE_BY_LABEL[t.label] ?? 10,
        bold: heading,
        page: prov.page_no,
        segments: [display],
        headingHint: t.label === 'section_header',
      },
    ];
  });
  lines = lines.filter((l) => !isSensitiveLine(l.text));
  return { lines, pageWidth };
};

export const ocrWithDocling = async (
  file: { bytes: Uint8Array; mimeType: string; fileName: string },
  config: DoclingConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lines: Line[]; pageWidth: number }> => {
  const form = new FormData();
  form.append(
    'files',
    new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }),
    file.fileName,
  );
  form.append('to_formats', 'json');
  form.append('do_ocr', 'true');
  form.append('image_export_mode', 'placeholder');
  let res: Response;
  try {
    res = await fetchImpl(`${config.url.replace(/\/$/, '')}/v1/convert/file`, {
      method: 'POST',
      body: form,
      headers: config.apiKey ? { 'X-Api-Key': config.apiKey } : {},
      signal: AbortSignal.timeout(config.timeoutMs ?? 60_000),
    });
  } catch {
    throw new ResumeReadError('ocr_failed');
  }
  if (!res.ok) throw new ResumeReadError('ocr_failed');
  const parsed = DoclingResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ResumeReadError('ocr_failed');
  return doclingToLines(parsed.data.document.json_content);
};
