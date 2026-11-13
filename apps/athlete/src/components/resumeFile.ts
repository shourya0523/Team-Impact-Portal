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

type PhotoType = Exclude<ResumeUploadRequest['mimeType'], 'application/pdf'>;
const PHOTO_TYPES: readonly string[] = RESUME_UPLOAD_LIMITS.mimeTypes.filter(
  (t) => t !== 'application/pdf',
);
const EXTENSION: Record<PhotoType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
};

/**
 * The photo's real type, which the server checks against its first bytes: the bytes themselves
 * for JPEG and PNG (the picker re-encodes on some platforms and not on web), else what the picker
 * reports.
 */
const photoTypeOf = (base64: string, reported: string | undefined): PhotoType => {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  const type = reported?.toLowerCase();
  if (type && PHOTO_TYPES.includes(type)) return type as PhotoType;
  throw new ResumePickError('Use a JPEG, PNG or HEIC photo.');
};

/**
 * Opens the system picker for a resume PDF, or a photo of a printed resume. Returns null when the
 * athlete cancels. Photos keep their own type (JPEG, PNG or HEIC).
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
  const mimeType = photoTypeOf(fileBase64, asset.mimeType);
  return checked({
    fileName: asset.fileName ?? `resume-photo.${EXTENSION[mimeType]}`,
    mimeType,
    sizeBytes: sizeOf(fileBase64),
    fileBase64,
  });
};
