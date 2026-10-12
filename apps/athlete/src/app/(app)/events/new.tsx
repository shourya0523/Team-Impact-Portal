import { Placeholder } from '@/components/Placeholder';

/** "/events/new" */
export default function CreateEvent() {
  return (
    <Placeholder
      title="Create event"
      wireframe="A3/C7"
      links={[{ label: 'Create', href: '/events/1', replace: true }]}
    />
  );
}
