/** Bytes from strings (as ASCII) and raw byte lists, for building test files. */
export const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : part,
    ),
  );

/** The first bytes of a real file of each type an upload may claim. */
export const SAMPLE_FILES = {
  'image/jpeg': bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10], 'JFIF'),
  'image/png': bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d], 'IHDR'),
  'image/webp': bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '),
  'image/heic': bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0], 'mif1'),
  'application/pdf': bytes('%PDF-1.7\n%'),
} as const;

/** A file of `type` that is exactly `size` bytes long, padded after its real first bytes. */
export const sampleFile = (type: keyof typeof SAMPLE_FILES, size: number) => {
  const file = new Uint8Array(size);
  file.set(SAMPLE_FILES[type].subarray(0, size));
  return file;
};
