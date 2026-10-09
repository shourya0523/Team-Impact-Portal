import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { PALETTE_SAMPLE_SIZE, type PixelSampler } from '../athlete-card/palette';
import { base64ToBytes, decodePng } from '../athlete-card/png';

/**
 * Shrinks the photo to 16 x 16 natively, then decodes that tiny PNG in JS. Works in Expo Go (no
 * custom native module), and the JS side only ever touches ~1 KB.
 */
export const samplePhoto: PixelSampler = async (uri) => {
  const image = await ImageManipulator.manipulate(uri)
    .resize({ width: PALETTE_SAMPLE_SIZE, height: PALETTE_SAMPLE_SIZE })
    .renderAsync();
  try {
    const { base64 } = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
    return base64 ? (decodePng(base64ToBytes(base64))?.data ?? null) : null;
  } finally {
    image.release();
  }
};
