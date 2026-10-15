import type {
  PendingRecruiter,
  Recruiter,
  RecruiterSignupRequest,
  RecruiterSignupResult,
} from '@team-impact/contracts';
import { post, request } from './client';

export const signup = {
  /** Work email only; the recruiter waits in `pending`, signed out, until staff approve. */
  recruiterSignUp: (body: RecruiterSignupRequest) =>
    post<RecruiterSignupResult>('/auth/recruiter-sign-up', body),
};

/** Staff's queue of recruiter sign-ups. */
export const staffSignup = {
  recruiterSignUps: () => request<PendingRecruiter[]>('/staff/recruiter-sign-ups'),
  approveRecruiter: (id: string) => post<Recruiter>(`/staff/recruiter-sign-ups/${id}/approve`),
};
