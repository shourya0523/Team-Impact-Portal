import { Placeholder, type PlaceholderLink } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';

/** "/signed": you're on the team. Enters the app at the role's first tab. */
export default function Signed() {
  const { role } = useRole();
  const links: PlaceholderLink[] = [
    { label: 'Enter the app', href: role ? firstTab(role) : '/sign-up', replace: true },
  ];
  if (role === 'parent')
    links.push({ label: "Set up your child's profile", href: '/child', replace: true });
  return <Placeholder title="Signed!" wireframe="A-10/11" links={links} />;
}
