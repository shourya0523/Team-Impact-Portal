import { Placeholder, type PlaceholderLink } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/home": the feed. Parents get a version with no composer (F5). */
export default function Home() {
  const { role } = useRole();
  const isParent = role === 'parent';
  const links: PlaceholderLink[] = [
    { label: 'Notifications', href: '/home/notifications' },
    { label: 'A post', href: '/home/posts/1' },
  ];
  if (!isParent) links.push({ label: 'New post', href: '/home/compose' });
  return (
    <Placeholder
      title={isParent ? 'Home feed (parent: no composer)' : 'Home feed'}
      wireframe={isParent ? 'F5' : 'A-13'}
      links={links}
    />
  );
}
