import { canCreateCommunity } from '@team-impact/contracts';
import { Placeholder, type PlaceholderLink } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/me/communities": your team, Team Impact, medical and interest communities (PRD v2.2 §5). */
export default function Communities() {
  const { role } = useRole();
  const links: PlaceholderLink[] = [{ label: 'A community', href: '/me/communities/1' }];
  // Teens create nothing; parents only medical communities (PRD §5 table).
  if (role && canCreateCommunity(role, 'medical')) {
    links.push({ label: 'Create community', href: '/me/communities/new' });
  }
  return <Placeholder title="Communities" wireframe="A-17" links={links} />;
}
