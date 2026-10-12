import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

/** "/home/posts/[id]" */
export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Placeholder
      title={`Post ${id}`}
      wireframe="A-15/16"
      links={[
        { label: 'Report', href: '/home/posts/report' },
        { label: 'Back to feed', href: '/home', replace: true },
      ]}
    />
  );
}
