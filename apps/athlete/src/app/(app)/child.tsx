import { Placeholder } from '@/components/Placeholder';

/** "/child" */
export default function ChildProfile() {
  return (
    <Placeholder
      title="Child profile"
      wireframe="A-38"
      links={[{ label: 'Team roster', href: '/team' }]}
    />
  );
}
