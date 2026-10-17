import type { AlumniProfile, Role } from '@team-impact/contracts';
import { Badge } from '@/ui';

/** Who gets alumni browse (PRD §8): never teens, parents, coaches or recruiters. The API agrees. */
export const ALUMNI_BROWSERS: readonly Role[] = [
  'athlete',
  'alumni_athlete',
  'alumni_mentor',
  'staff',
];

/** "Mentoring" and "Hiring" badges for an alumnus; `onBrand` when drawn on the navy hero. */
export function HelpBadges({
  alumnus,
  onBrand,
}: {
  alumnus: Pick<AlumniProfile, 'mentoring' | 'hiring'>;
  onBrand?: boolean;
}) {
  return (
    <>
      {alumnus.mentoring && (
        <Badge caps variant={onBrand ? 'brandTint' : 'brand'} label="Mentoring" />
      )}
      {alumnus.hiring && <Badge caps variant="action" label="Hiring" />}
    </>
  );
}

/** "mentoring and hiring", for the line saying why a profile is shown. */
export const helpText = (a: Pick<AlumniProfile, 'mentoring' | 'hiring'>) =>
  [a.mentoring && 'mentoring', a.hiring && 'hiring'].filter(Boolean).join(' and ');
