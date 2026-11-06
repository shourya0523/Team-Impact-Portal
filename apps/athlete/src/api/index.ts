import { activity } from './activity';
import { communities } from './communities';
import { communityMembers } from './community-members';
import { join } from './join';
import { safety } from './safety';
import { profiles } from './profiles';
import { session } from './session';
import { team } from './team';
import { signup } from './signup';

export { ApiRequestError, request, track } from './client';

/** One object for every call; each product area keeps its calls in its own file. */
export const api = {
  ...session,
  ...communities,
  ...join,
  ...safety,
  ...team,
  ...signup,
  ...activity,
  ...profiles,
  ...communityMembers,
};
