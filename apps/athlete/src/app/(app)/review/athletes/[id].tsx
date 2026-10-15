import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

/** "/review/athletes/[id]" */
export default function RecruiterCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Placeholder
      title={`Athlete card ${id}`}
      wireframe="Recruiter: card and contacts"
      links={[
        { label: 'Save to a list', href: '/lists' },
        { label: 'Back to review', href: '/review', replace: true },
      ]}
    />
  );
}
