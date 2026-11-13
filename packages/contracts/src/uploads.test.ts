import { describe, expect, it } from 'vitest';
import { UPLOAD_LIMITS, UploadRequest } from './index';

describe('uploads', () => {
  it('caps size and type per purpose', () => {
    const photo = {
      purpose: 'card_photo',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      rightsAffirmed: true,
    };
    expect(UploadRequest.safeParse(photo).success).toBe(true);
    expect(UploadRequest.safeParse({ ...photo, mimeType: 'application/pdf' }).success).toBe(false);
    expect(
      UploadRequest.safeParse({ ...photo, sizeBytes: UPLOAD_LIMITS.card_photo.maxBytes + 1 })
        .success,
    ).toBe(false);

    const resume = { purpose: 'resume', mimeType: 'application/pdf', sizeBytes: 1000 };
    expect(UploadRequest.safeParse(resume).success).toBe(true);
    expect(UploadRequest.safeParse({ ...resume, mimeType: 'text/html' }).success).toBe(false);
    expect(
      UploadRequest.safeParse({ ...resume, sizeBytes: UPLOAD_LIMITS.resume.maxBytes + 1 }).success,
    ).toBe(false);
  });

  it('requires a rights affirmation on photo uploads only', () => {
    const photo = { purpose: 'post_image', mimeType: 'image/png', sizeBytes: 1000 };
    expect(UploadRequest.safeParse(photo).success).toBe(false);
    expect(UploadRequest.safeParse({ ...photo, rightsAffirmed: false }).success).toBe(false);
    expect(UploadRequest.safeParse({ ...photo, rightsAffirmed: true }).success).toBe(true);
  });

  it('needs the child for a child photo', () => {
    const photo = {
      purpose: 'child_photo',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      rightsAffirmed: true,
    };
    expect(UploadRequest.safeParse(photo).success).toBe(false);
    expect(
      UploadRequest.safeParse({ ...photo, childId: '00000000-0000-4000-8000-000000000001' })
        .success,
    ).toBe(true);
  });
});
