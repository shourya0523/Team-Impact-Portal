import { z } from 'zod';
import { Role } from './roles';

/**
 * Development and staging only, while the API runs on mocks: sign in as the fixture user for a
 * role, so every role's navigation can be checked without passwords. The real API never has it.
 */
export const DevSignInRequest = z.object({
  role: Role,
  /** Sign in as someone of that role who is on no team yet, to walk the join flow. */
  newcomer: z.boolean().optional(),
});
export type DevSignInRequest = z.infer<typeof DevSignInRequest>;
