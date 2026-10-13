import { Placeholder } from '@/components/Placeholder';

/** "/home/notifications" */
export default function Notifications() {
  return (
    <Placeholder
      title="Notifications"
      wireframe="P1"
      links={[
        { label: 'A post', href: '/home/posts/1' },
        { label: 'An event', href: '/events/1' },
        { label: 'A community', href: '/me/communities/1' },
        { label: 'Notification settings', href: '/me/safety' },
      ]}
    />
  );
}
