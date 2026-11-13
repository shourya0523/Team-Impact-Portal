import { UPLOAD_LIMITS } from '@team-impact/contracts';

/** Every content type some upload purpose allows. */
export type AllowedMimeType =
  (typeof UPLOAD_LIMITS)[keyof typeof UPLOAD_LIMITS]['mimeTypes'][number];

/** How many leading bytes `matchesSignature` needs to see. */
export const SIGNATURE_BYTES = 16;

const ascii = (bytes: Uint8Array, start: number, text: string) =>
  [...text].every((char, i) => bytes[start + i] === char.charCodeAt(0));

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, i) => bytes[i] === byte);

// HEIC is an ISO media file: a `ftyp` box whose major brand names a HEIF image.
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

/**
 * Magic bytes per allowed type. Keyed by every type an upload may claim, so allowing a new type in
 * the contracts fails to compile until it has a check here.
 */
const SIGNATURES: Record<AllowedMimeType, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'),
  'image/heic': (b) => ascii(b, 4, 'ftyp') && HEIF_BRANDS.some((brand) => ascii(b, 8, brand)),
  'application/pdf': (b) => ascii(b, 0, '%PDF-'),
};

/** Whether a file's first bytes are what its claimed type's files start with. */
export const matchesSignature = (mimeType: string, firstBytes: Uint8Array): boolean => {
  const allowed = (type: string): type is AllowedMimeType => Object.hasOwn(SIGNATURES, type);
  return allowed(mimeType) && SIGNATURES[mimeType](firstBytes);
};
