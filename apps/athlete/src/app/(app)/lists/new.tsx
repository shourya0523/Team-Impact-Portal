import { Placeholder } from '@/components/Placeholder';

/** "/lists/new" */
export default function NewList() {
  return (
    <Placeholder
      title="New list"
      wireframe="R5"
      links={[{ label: 'Create list', href: '/lists', replace: true }]}
    />
  );
}
