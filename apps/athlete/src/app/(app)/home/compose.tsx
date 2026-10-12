import { Placeholder } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/home/compose": new post. Teens can only post to their team (T3). */
export default function Compose() {
  const { role } = useRole();
  const isTeen = role === 'teen';
  return (
    <Placeholder
      title={isTeen ? 'New post (teen: team only)' : 'New post'}
      wireframe={isTeen ? 'T3' : 'A-14'}
      links={[
        { label: 'Post', href: '/home', replace: true },
        ...(isTeen ? [] : [{ label: 'Make it an event', href: '/events/new' as const }]),
      ]}
    />
  );
}
