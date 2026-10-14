import { Placeholder, type PlaceholderLink } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/onboarding/details": step 2 of sign-up. Each role has its own details board and next step. */
export default function Details() {
  const { role } = useRole();

  const next: PlaceholderLink =
    role === 'coach'
      ? { label: 'Join as coach', href: '/team', replace: true } // A-12 → coach team
      : role === 'alumni_athlete' || role === 'alumni_mentor'
        ? { label: 'Finish', href: '/home', replace: true } // A-47 → home
        : role === 'recruiter'
          ? { label: 'Verify company', href: '/review', replace: true } // recruiter → quick review
          : { label: 'Next: house rules', href: '/onboarding/terms' }; // athlete, parent, teen

  return (
    <Placeholder
      title={`Details: ${role ?? 'no role picked'}`}
      wireframe="DetailsAthlete / DetailsParent / DetailsTeen / DetailsCoach (A-12) / DetailsAlumni (A-47) / DetailsRecruiter"
      links={[next, { label: 'Back: pick a different role', href: '/sign-up', replace: true }]}
    />
  );
}
