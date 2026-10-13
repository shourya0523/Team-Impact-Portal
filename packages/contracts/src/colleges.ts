import { z } from 'zod';
import { Id } from './common';

/**
 * Staff keep one managed list with one name per college, so team creation and the join search
 * never split a college across spellings.
 */
export const College = z.object({
  id: Id,
  name: z.string(),
});
export type College = z.infer<typeof College>;

const CollegeName = z.string().trim().min(1).max(120);

/** Staff only. Also used to rename. */
export const SaveCollegeRequest = z.object({ name: CollegeName });
export type SaveCollegeRequest = z.infer<typeof SaveCollegeRequest>;

/** Staff only: fold a duplicate into `intoCollegeId`, moving its teams across. */
export const MergeCollegeRequest = z.object({ intoCollegeId: Id });
export type MergeCollegeRequest = z.infer<typeof MergeCollegeRequest>;
