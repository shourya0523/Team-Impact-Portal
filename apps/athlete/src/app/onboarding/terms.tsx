import { Placeholder } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/onboarding/terms": house rules. Teens also confirm a parent or guardian knows they're joining. */
export default function Terms() {
  const { role } = useRole();
  return (
    <Placeholder
      title={role === 'teen' ? 'House rules (teen: parent agreed)' : 'House rules'}
      wireframe="A-06"
      links={[{ label: 'I agree', href: '/onboarding/find-team' }]}
    />
  );
}
