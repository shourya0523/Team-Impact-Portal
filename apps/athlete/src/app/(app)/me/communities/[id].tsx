import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

/** "/me/communities/[id]" */
export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Placeholder
      title={`Community ${id}`}
      wireframe="A-18"
      links={[{ label: 'Post in this community', href: '/home/compose' }]}
    />
  );
}
