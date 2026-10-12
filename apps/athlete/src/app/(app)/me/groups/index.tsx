import { Placeholder } from '@/components/Placeholder';

/** "/me/groups" */
export default function Groups() {
  return (
    <Placeholder
      title="Groups"
      wireframe="A-17"
      links={[
        { label: 'A group', href: '/me/groups/1' },
        { label: 'Create group', href: '/me/groups/new' },
      ]}
    />
  );
}
