import { describe, expect, it } from 'vitest';
import {
  canBeOpenToRecruiting,
  ConfirmResumeRequest,
  Profile,
  ProfileCommunity,
  ResumeUploadRequest,
  UpdateChildRequest,
  UpdateMySettingsRequest,
} from './index';

const ID = '00000000-0000-4000-8000-000000000001';

describe('profiles contract', () => {
  it('cannot express a medical community on a profile', () => {
    expect(ProfileCommunity.safeParse({ id: ID, name: 'x', kind: 'medical' }).success).toBe(false);
    expect(ProfileCommunity.safeParse({ id: ID, name: 'x', kind: 'interest' }).success).toBe(true);
  });

  it('gives teen profiles no contact field', () => {
    const teen = Profile.parse({
      kind: 'teen',
      user: { id: ID, firstName: 'N', lastName: 'K', role: 'teen', avatarUrl: null },
      teams: [],
      contact: { email: 'leak@example.org' },
    });
    expect(teen).not.toHaveProperty('contact');
  });

  it('keeps child profiles under 13 and lets parents set only the child fields', () => {
    expect(UpdateChildRequest.safeParse({ age: 12 }).success).toBe(true);
    expect(UpdateChildRequest.safeParse({ age: 13 }).success).toBe(false);
    expect(UpdateChildRequest.safeParse({ openToRecruiting: true }).success).toBe(false);
    expect(UpdateChildRequest.safeParse({ birthDate: '2017-01-01' }).success).toBe(false);
  });

  it('lets only card holders be open to recruiting', () => {
    expect(canBeOpenToRecruiting('athlete')).toBe(true);
    expect(canBeOpenToRecruiting('alumni_athlete')).toBe(true);
    expect(canBeOpenToRecruiting('teen')).toBe(false);
    expect(canBeOpenToRecruiting('parent')).toBe(false);
  });

  it('rejects unknown settings and oversized or unsupported uploads', () => {
    expect(UpdateMySettingsRequest.safeParse({ medical: false }).success).toBe(false);
    const upload = { fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 1000 };
    expect(ResumeUploadRequest.safeParse(upload).success).toBe(true);
    expect(ResumeUploadRequest.safeParse({ ...upload, sizeBytes: 50_000_000 }).success).toBe(false);
    expect(ResumeUploadRequest.safeParse({ ...upload, mimeType: 'text/html' }).success).toBe(false);
    expect(ConfirmResumeRequest.safeParse({ draftId: ID, fields: { major: '' } }).success).toBe(
      false,
    );
  });
});
