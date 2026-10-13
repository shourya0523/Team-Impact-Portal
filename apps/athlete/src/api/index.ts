import { activity } from './activity';
import { communities } from './communities';
import { join } from './join';
import { profiles } from './profiles';
import { session } from './session';
import { signup } from './signup';

export { ApiRequestError, request } from './client';

/** One object for every call; each product area keeps its calls in its own file. */
export const api = {
  ...session,
  ...communities,
  ...join,
  ...signup,
  ...activity,
  ...profiles,
};
