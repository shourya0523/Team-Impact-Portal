import { Placeholder, type PlaceholderLink } from '@/components/Placeholder';
import { useRole } from '@/navigation/role';

/** "/team": the Team tab shows a different board per role. */
export default function Team() {
  const { role } = useRole();

  if (role === 'coach') {
    return (
      <Placeholder
        title="Coach: requests and members"
        wireframe="A-26/27"
        links={[
          { label: 'Team QR code', href: '/team/qr' },
          { label: 'Remove a member', href: '/team/remove' },
          { label: 'Add a coach', href: '/team/add-coach' },
          { label: 'Edit team details', href: '/team/edit' },
        ]}
      />
    );
  }

  const links: PlaceholderLink[] = [];
  if (role === 'parent') links.push({ label: "Your child's profile", href: '/child' });
  return (
    <Placeholder
      // Teens see the roster without athletes' contact details (PRD rule).
      title={role === 'teen' ? 'Roster (teen view: no contacts)' : 'Roster'}
      wireframe="A-23"
      links={links}
    />
  );
}
