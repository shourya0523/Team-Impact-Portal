import { lists } from './lists';
import { recruiter } from './recruiter';
import { session } from './session';
import { signup, staffSignup } from './signup';
import { staff } from './staff';
import { staffAdmin } from './staff-admin';
import { staffTools } from './staff-tools';

export { ApiRequestError, request } from './client';

/** One object for every call; each product area keeps its calls in its own file. */
export const api = {
  ...session,
  ...recruiter,
  ...lists,

  ...signup,
  staff: { ...staff, ...staffSignup, ...staffAdmin, ...staffTools },
};
