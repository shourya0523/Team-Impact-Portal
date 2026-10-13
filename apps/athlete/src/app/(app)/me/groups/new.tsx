import { Placeholder } from '@/components/Placeholder';

/** "/me/groups/new" */
export default function CreateGroup() {
  return (
    <Placeholder
      title="Create group"
      wireframe="A6"
      links={[{ label: 'Create', href: '/me/groups/1', replace: true }]}
    />
  );
}
