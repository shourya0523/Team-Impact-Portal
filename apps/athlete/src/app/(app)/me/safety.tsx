import { Placeholder } from '@/components/Placeholder';

/** "/me/safety" */
export default function Safety() {
  return (
    <Placeholder
      title="Notifications, blocked, delete"
      wireframe="A-43/44/45"
      links={[{ label: 'Back to Me', href: '/me', replace: true }]}
    />
  );
}
