import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * iOS and Android: write the PNG to a file in the app's cache, then open the share sheet with it,
 * where the coach can save it to Photos, AirDrop it or send it in a message. A share sheet takes a
 * file, not a data URL. Web uses `savePng.web.ts`.
 */
export const savePng = async (base64: string, fileName: string) => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  const file = new File(Paths.cache, fileName);
  // Exporting the same code twice would otherwise fail: create() throws if the file exists.
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png', // Android: which apps can take it
    UTI: 'public.png', // iOS: the same, in Apple's terms
    dialogTitle: fileName, // Android: the share sheet's title
  });
};
