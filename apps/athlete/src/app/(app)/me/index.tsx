import { router } from 'expo-router';
import { Button } from 'react-native';
import { Placeholder, type PlaceholderLink } from '@/components/Placeholder';
import { api } from '@/api';
import { useRole } from '@/navigation/role';

/** "/me": every role has this tab. Rows depend on the role; sign out to try another role. */
export default function Me() {
  const { role, setRole } = useRole();

  const links: PlaceholderLink[] = [];
  if (role === 'athlete') links.push({ label: 'Contacts and recruiting', href: '/me/recruiting' });
  if (role !== 'recruiter') links.push({ label: 'My communities', href: '/me/communities' });
  if (role === 'athlete' || role === 'alumni_athlete' || role === 'alumni_mentor') {
    links.push({ label: 'Browse alumni', href: '/me/alumni' });
  }
  if (role === 'alumni_athlete')
    links.push({ label: 'Claim a pre-built card', href: '/card/claim' });
  links.push({ label: 'Notifications, blocked, delete account', href: '/me/safety' });

  return (
    <Placeholder title={`Me (signed in as ${role})`} wireframe="A-39" links={links}>
      <Button
        title="Sign out / switch role"
        onPress={() => {
          // Clear the session cookie too; go to the landing page even if the API is down.
          void api.signOut().catch(() => undefined);
          setRole(null);
          router.replace('/welcome');
        }}
      />
    </Placeholder>
  );
}
