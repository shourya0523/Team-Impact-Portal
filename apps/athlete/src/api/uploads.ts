import {
  UPLOAD_LIMITS,
  type MediaPurpose,
  type UploadRequest,
  type UploadResponse,
} from '@team-impact/contracts';
import { post } from './client';

/**
 * The one upload path (TI-111): ask for a signed URL, PUT the file to it, confirm. The same calls
 * work on the mock API and the real one, so screens don't change when the app moves off the mock.
 */
export const uploads = {
  startUpload: (body: UploadRequest) => post<UploadResponse>('/uploads', body),
  completeUpload: (mediaId: string) => post<void>(`/uploads/${mediaId}/complete`),
};

/** Why a picked photo can't be uploaded, shown to the person who picked it. */
export class UploadProblem extends Error {}

type PhotoPurpose = Exclude<MediaPurpose, 'resume'>;

/**
 * Uploads a photo the user picked (`uri` from the image picker) as `purpose`. Reads the file first
 * so the type and exact size sent match what's signed, and checks them against the same limits
 * the API enforces, so a too-large or HEIC photo gets a clear message instead of a refusal.
 */
export const uploadPhoto = async (
  uri: string,
  target:
    { purpose: 'child_photo'; childId: string } | { purpose: Exclude<PhotoPurpose, 'child_photo'> },
  /** The picker's guess, used when the file itself doesn't say. */
  mimeTypeHint?: string | null,
): Promise<string> => {
  const file = await (await fetch(uri)).blob();
  const mimeType = file.type || mimeTypeHint || '';
  const limits = UPLOAD_LIMITS[target.purpose];
  if (!(limits.mimeTypes as readonly string[]).includes(mimeType)) {
    throw new UploadProblem('Choose a JPEG, PNG or WebP photo.');
  }
  if (file.size > limits.maxBytes) {
    throw new UploadProblem(
      `Choose a photo under ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`,
    );
  }

  const signed = await uploads.startUpload({
    ...target,
    mimeType,
    sizeBytes: file.size,
    rightsAffirmed: true,
  } as UploadRequest);
  // The signed URL is the permission; it must not carry our session cookie.
  const sent = await fetch(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: file,
    credentials: 'omit',
  });
  if (!sent.ok) throw new UploadProblem('The photo didn’t upload. Try again.');
  await uploads.completeUpload(signed.mediaId);
  return signed.mediaId;
};
