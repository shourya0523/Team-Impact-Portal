import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Native PNG export (iOS and Android, TI-114): snapshots a flat `AthleteCardFace` with
 * react-native-view-shot, names the file and opens the share sheet. Capture the flat face, never
 * the interactive card, so tilt and shine can't end up in the image. The web uses `cardPng.ts`.
 */
export async function shareCardFace(face: RefObject<View | null>, fileName: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  // Full pixel density of the view as laid out; PNG keeps the rounded corners transparent.
  const uri = await captureRef(face, { format: 'png', result: 'tmpfile' });
  const named = new File(Paths.cache, fileName);
  if (named.exists) named.delete();
  await new File(uri).move(named);
  await Sharing.shareAsync(named.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Share your Baseball Card',
  });
}
