import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

/** "/me/alumni/[id]" */
export default function AlumniProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Placeholder
      title={`Alumni profile ${id}`}
      wireframe="L4"
      links={[{ label: 'Back to alumni', href: '/me/alumni', replace: true }]}
    />
  );
}
