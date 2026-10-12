import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

/** "/events/[id]" */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Placeholder
      title={`Event ${id}`}
      wireframe="A-21"
      links={[{ label: 'Back to events', href: '/events', replace: true }]}
    />
  );
}
