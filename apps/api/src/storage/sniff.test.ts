import { describe, expect, it } from 'vitest';
import { bytes, SAMPLE_FILES } from '../test/files';
import { matchesSignature } from './sniff';

describe('matchesSignature', () => {
  it('accepts each allowed type when its bytes match', () => {
    for (const [type, file] of Object.entries(SAMPLE_FILES)) {
      expect(matchesSignature(type, file), type).toBe(true);
    }
  });

  it('rejects a file whose bytes belong to a different type', () => {
    expect(matchesSignature('image/jpeg', SAMPLE_FILES['image/png'])).toBe(false);
    expect(matchesSignature('application/pdf', SAMPLE_FILES['image/jpeg'])).toBe(false);
    expect(matchesSignature('image/webp', bytes('RIFF', [0, 0, 0, 0], 'WAVEfmt '))).toBe(false);
    expect(matchesSignature('image/heic', bytes([0, 0, 0, 0x18], 'ftypisom'))).toBe(false);
  });

  it('rejects HTML, empty files and types no upload allows', () => {
    expect(matchesSignature('image/jpeg', bytes('<!doctype html>'))).toBe(false);
    expect(matchesSignature('application/pdf', new Uint8Array())).toBe(false);
    expect(matchesSignature('text/html', bytes('<!doctype html>'))).toBe(false);
  });
});
