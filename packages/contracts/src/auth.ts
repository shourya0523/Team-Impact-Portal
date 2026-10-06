import { z } from 'zod';

export const Email = z.email().transform((value) => value.toLowerCase());

export const LoginRequest = z.object({
  email: Email,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SignupRequest = z.object({
  email: Email,
  password: z.string().min(12, 'Use at least 12 characters'),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
export type SignupRequest = z.infer<typeof SignupRequest>;
