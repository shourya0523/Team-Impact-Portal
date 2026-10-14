import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { brandPalette, paletteFromPixels } from './palette';
import { base64ToBytes, decodePng } from './png';

const solid = (r: number, g: number, b: number, count = 256) =>
  Array.from({ length: count }, () => [r, g, b, 255]).flat();

const relativeLuminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Builds a 2x1 RGB PNG using the Sub filter, to exercise unfiltering. */
const tinyPng = () => {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of bytes) c = (crcTable[(c ^ b) & 255] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    out.set(
      [...type].map((ch) => ch.charCodeAt(0)),
      4,
    );
    out.set(body, 8);
    view.setUint32(8 + body.length, crc(out.subarray(4, 8 + body.length)));
    return out;
  };
  const ihdr = new Uint8Array([0, 0, 0, 2, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  // Pixels (200,10,10) and (210,30,20); Sub filter stores the second as a delta.
  const scanline = new Uint8Array([1, 200, 10, 10, 10, 20, 10]);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(scanline)),
    chunk('IEND', new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((offset, p) => (png.set(p, offset), offset + p.length), 0);
  return png;
};

describe('decodePng', () => {
  it('decodes filtered RGB scanlines to RGBA', () => {
    const image = decodePng(tinyPng());
    expect(image?.width).toBe(2);
    expect([...(image?.data ?? [])]).toEqual([200, 10, 10, 255, 210, 30, 20, 255]);
  });

  it('round-trips through base64', () => {
    const png = tinyPng();
    const base64 = btoa(String.fromCharCode(...png));
    expect([...base64ToBytes(`data:image/png;base64,${base64}`)]).toEqual([...png]);
  });

  it('rejects non-PNG input', () => {
    expect(decodePng(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('paletteFromPixels', () => {
  it('follows the photo hue', () => {
    const red = paletteFromPixels(solid(220, 30, 40));
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(red.deep.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g ?? 0);
    expect(r).toBeGreaterThan(b ?? 0);
  });

  it('keeps white text readable on dark tones, even for a bright yellow photo', () => {
    const palette = paletteFromPixels(solid(255, 230, 40));
    for (const tone of [palette.deep, palette.base, palette.band]) {
      expect(relativeLuminance(tone)).toBeLessThanOrEqual(0.12);
    }
    expect(relativeLuminance(palette.tint)).toBeGreaterThan(0.8);
  });

  it('prefers a vivid minority over a grey majority', () => {
    const pixels = [...solid(128, 128, 128, 180), ...solid(30, 90, 230, 76)];
    const palette = paletteFromPixels(pixels);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(palette.deep.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r ?? 0);
  });

  it('falls back to the brand palette for fully transparent images', () => {
    expect(paletteFromPixels(Array.from({ length: 64 }, () => 0))).toEqual(brandPalette);
  });
});
