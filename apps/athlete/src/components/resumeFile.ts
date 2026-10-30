import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { RESUME_UPLOAD_LIMITS, type ResumeUploadRequest } from '@team-impact/contracts';

export type ResumeKind = 'pdf' | 'photo';

/** What the upload call needs: the file travels as base64 and is never kept on the server. */
export type PickedResume = Required<
  Pick<ResumeUploadRequest, 'fileName' | 'mimeType' | 'sizeBytes' | 'fileBase64'>
>;

export class ResumePickError extends Error {}

const MB = 1024 * 1024;

/** Reads any local or web file URI as base64. Works on iOS, Android and web alike. */
const readBase64 = async (uri: string): Promise<string> => {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(new ResumePickError('We couldn’t open that file. Try another.'));
    reader.readAsDataURL(blob);
  });
};

/** Decoded size of a base64 string, without decoding it. */
const sizeOf = (base64: string) =>
  Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);

const checked = (file: PickedResume): PickedResume => {
  if (file.sizeBytes > RESUME_UPLOAD_LIMITS.maxBytes) {
    throw new ResumePickError(
      `That file is over ${RESUME_UPLOAD_LIMITS.maxBytes / MB} MB. Try a smaller one.`,
    );
  }
  return file;
};

/**
 * Opens the system picker for a resume PDF, or a photo of a printed resume. Returns null when the
 * athlete cancels. Photos come back as JPEG.
 */
export const pickResume = async (kind: ResumeKind): Promise<PickedResume | null> => {
  if (kind === 'pdf') {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return null;
    const fileBase64 = asset.base64 ?? (await readBase64(asset.uri));
    return checked({
      fileName: asset.name,
      mimeType: 'application/pdf',
      sizeBytes: asset.size ?? sizeOf(fileBase64),
      fileBase64,
    });
  }
  // The system photo picker needs no permission prompt; it is scoped to the one photo chosen.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const fileBase64 = asset.base64 ?? (await readBase64(asset.uri));
  return checked({
    fileName: asset.fileName ?? 'resume-photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: sizeOf(fileBase64),
    fileBase64,
  });
};
