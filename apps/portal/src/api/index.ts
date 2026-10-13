import { recruiter } from './recruiter';
import { session } from './session';
import { signup, staffSignup } from './signup';
import { staff } from './staff';

export { ApiRequestError, request } from './client';

/** One object for every call; each product area keeps its calls in its own file. */
export const api = {
  ...session,
  ...recruiter,
  ...signup,
  staff: { ...staff, ...staffSignup },
};
