import { PALETTE_SAMPLE_SIZE, type PixelSampler } from '../athlete-card/palette';

/** Draws the photo onto a 16 x 16 canvas and reads it back. Cross-origin photos need CORS. */
export const samplePhoto: PixelSampler = async (uri) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = uri;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PALETTE_SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, PALETTE_SAMPLE_SIZE, PALETTE_SAMPLE_SIZE);
  return context.getImageData(0, 0, PALETTE_SAMPLE_SIZE, PALETTE_SAMPLE_SIZE).data;
};
