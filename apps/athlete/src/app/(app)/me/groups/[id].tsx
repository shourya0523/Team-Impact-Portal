import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

/** "/me/groups/[id]" */
export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Placeholder
      title={`Group ${id}`}
      wireframe="A-18"
      links={[{ label: 'Post in this group', href: '/home/compose' }]}
    />
  );
}
