import type { MediaPurpose, UploadRequest } from '@team-impact/contracts';
import { canSeeChild } from './profiles';
import type { MockUser, MockWorld } from './world';

/**
 * Uploads on the mock API, following the real flow from the uploads PR (#8, `routes/media.ts`):
 *
 *   POST /uploads             ask for a signed URL (rights affirmed for photos)
 *   PUT  <url>                send the file there, with exactly the type and size asked for
 *   POST /uploads/:id/complete  confirm; a child photo becomes the child's photo
 *   GET  /media/:id           read it, only if you may (a child photo: their team and family)
 *
 * Same paths, bodies and rules as the real API, so the app's upload code doesn't change when it
 * moves off the mock. The difference: files live in memory, and the "signed URL" is a mock-only
 * PUT route on this API that expires like a real one.
 */

/** How long a signed upload URL works, as on the real API. */
export const UPLOAD_URL_TTL_MS = 5 * 60 * 1000;

export interface MockUpload {
  id: string;
  ownerId: string;
  purpose: MediaPurpose;
  childId: string | null;
  mimeType: string;
  sizeBytes: number;
  rightsAffirmedAt: string | null;
  status: 'pending' | 'ready';
  expiresAt: number;
  /** The file, once PUT. */
  bytes: Buffer | null;
}

/** Starts an upload, or explains why `u` can't. Mirrors POST /uploads on the real API. */
export const startUpload = (
  world: MockWorld,
  u: MockUser,
  body: UploadRequest,
  now = Date.now(),
): MockUpload | { status: number; error: string } => {
  const childId = body.purpose === 'child_photo' ? body.childId : null;
  if (childId && !world.children.some((c) => c.id === childId && c.parentId === u.id)) {
    return { status: 403, error: 'Only the child’s parent can upload their photo' };
  }
  const upload: MockUpload = {
    id: world.newId(),
    ownerId: u.id,
    purpose: body.purpose,
    childId,
    mimeType: body.mimeType,
    sizeBytes: body.sizeBytes,
    rightsAffirmedAt: 'rightsAffirmed' in body ? new Date(now).toISOString() : null,
    status: 'pending',
    expiresAt: now + UPLOAD_URL_TTL_MS,
    bytes: null,
  };
  world.uploads.push(upload);
  return upload;
};

/**
 * Accepts the file at the signed URL. Like a real presigned URL, the URL itself is the permission:
 * no session is needed, but it must still be pending and unexpired, and the file must be exactly
 * the type and size that were signed.
 */
export const receiveFile = (
  world: MockWorld,
  id: string,
  contentType: string | undefined,
  bytes: Buffer,
  now = Date.now(),
): { status: number; error: string } | null => {
  const upload = world.uploads.find((x) => x.id === id);
  if (!upload || upload.status !== 'pending' || now > upload.expiresAt) {
    return { status: 403, error: 'This upload link has expired' };
  }
  if (contentType !== upload.mimeType || bytes.length !== upload.sizeBytes) {
    return { status: 403, error: 'The file doesn’t match what this link was signed for' };
  }
  upload.bytes = bytes;
  return null;
};

/** Confirms an upload. A child photo becomes the child's photo, served from `mediaUrl`. */
export const completeUpload = (
  world: MockWorld,
  u: MockUser,
  id: string,
  mediaUrl: string,
): { status: number; error: string } | null => {
  const upload = world.uploads.find((x) => x.id === id);
  if (!upload || upload.ownerId !== u.id) return { status: 404, error: 'Upload not found' };
  if (upload.status === 'ready') return null; // confirming twice is harmless
  if (!upload.bytes) return { status: 409, error: 'The file has not been uploaded yet' };
  upload.status = 'ready';
  if (upload.childId) {
    const child = world.children.find((c) => c.id === upload.childId);
    if (child) child.photoUrl = mediaUrl;
  }
  return null;
};

/**
 * Whether `u` may read a finished upload. A child photo goes to exactly who may see the child's
 * profile (team and family, never recruiters, not across a block); anything else to its owner,
 * until the feature that shows it adds its own rule (as on the real API).
 */
export const canViewUpload = (world: MockWorld, u: MockUser, upload: MockUpload) => {
  if (upload.status !== 'ready') return false;
  if (upload.purpose !== 'child_photo') return upload.ownerId === u.id;
  const child = world.children.find((c) => c.id === upload.childId);
  return !!child && canSeeChild(world, child, u);
};
