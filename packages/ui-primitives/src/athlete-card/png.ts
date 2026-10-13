import { unzlibSync } from 'fflate';

/**
 * Minimal PNG decoder for the 16 x 16 thumbnails the native card samples colours from. React
 * Native has no canvas, so this is what turns expo-image-manipulator's output into pixels without
 * a dev build. Supports 8- and 16-bit grey, grey+alpha, RGB and RGBA, non-interlaced: what the iOS
 * and Android encoders emit. Returns null for anything else so the caller can fall back.
 */
export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel. */
  data: Uint8Array;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charCodeAt(i)] = i;

export const base64ToBytes = (base64: string) => {
  const clean = base64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byte = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)] ?? 0;
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)] ?? 0;
    const c = B64_LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const d = B64_LOOKUP[clean.charCodeAt(i + 3)] ?? 0;
    bytes[byte++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[byte++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[byte++] = ((c & 3) << 6) | d;
  }
  return bytes.subarray(0, byte);
};

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export const decodePng = (bytes: Uint8Array): DecodedImage | null => {
  if (SIGNATURE.some((value, i) => bytes[i] !== value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  let idatLength = 0;

  for (let pos = 8; pos + 8 <= bytes.length;) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = body[8] ?? 0;
      colorType = body[9] ?? -1;
      if (body[12] !== 0) return null; // interlaced
    } else if (type === 'IDAT') {
      idat.push(body);
      idatLength += body.length;
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }

  const channels = CHANNELS[colorType];
  if (!channels || (depth !== 8 && depth !== 16) || !width || !height) return null;

  const compressed = new Uint8Array(idatLength);
  idat.reduce((offset, chunk) => (compressed.set(chunk, offset), offset + chunk.length), 0);
  const raw = unzlibSync(compressed);

  const bpp = (channels * depth) / 8;
  const stride = width * bpp;
  if (raw.length < (stride + 1) * height) return null;
  const data = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    for (let x = 0; x < stride; x++) {
      const value = raw[rowStart + 1 + x] ?? 0;
      const left = x >= bpp ? (cur[x - bpp] ?? 0) : 0;
      const up = prev[x] ?? 0;
      const upLeft = x >= bpp ? (prev[x - bpp] ?? 0) : 0;
      const predictor =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0;
      cur[x] = (value + predictor) & 255;
    }
    // 16-bit samples are big-endian, so the first byte of each is the 8-bit approximation.
    const step = depth / 8;
    for (let x = 0; x < width; x++) {
      const at = (i: number) => cur[x * bpp + i * step] ?? 0;
      const out = (y * width + x) * 4;
      const grey = channels <= 2;
      data[out] = at(0);
      data[out + 1] = grey ? at(0) : at(1);
      data[out + 2] = grey ? at(0) : at(2);
      data[out + 3] = channels === 4 ? at(3) : channels === 2 ? at(1) : 255;
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data };
};
