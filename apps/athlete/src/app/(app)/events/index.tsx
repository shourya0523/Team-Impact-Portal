import { Placeholder } from '@/components/Placeholder';

/** "/events" */
export default function Events() {
  return (
    <Placeholder
      title="Events"
      wireframe="A-20"
      links={[
        { label: 'An event', href: '/events/1' },
        { label: 'Create event', href: '/events/new' },
      ]}
    />
  );
}
