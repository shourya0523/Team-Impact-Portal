import { Placeholder } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/onboarding/request": request to join a team found by search (parent and athlete variants). */
export default function Request() {
  const { role } = useRole();
  return (
    <Placeholder
      title={role === 'parent' ? 'Request to join (parent)' : 'Request to join (athlete)'}
      wireframe="A-09 / A1"
      links={[
        { label: 'Send request', href: '/onboarding/pending' },
        { label: 'Back to find team', href: '/onboarding/find-team', replace: true },
      ]}
    />
  );
}
