import { communities } from './communities';
import { join } from './join';
import { session } from './session';
import { team } from './team';
import { signup } from './signup';

export { ApiRequestError, request } from './client';

/** One object for every call; each product area keeps its calls in its own file. */
export const api = {
  ...session,
  ...communities,
  ...join,
  ...team,
  ...signup,
};
