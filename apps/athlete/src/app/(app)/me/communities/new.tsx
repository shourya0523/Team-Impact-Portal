import { Placeholder } from '@/components/Placeholder';

/** "/me/communities/new": interest or medical; parents get medical only. */
export default function CreateCommunity() {
  return (
    <Placeholder
      title="Create community"
      wireframe="A6"
      links={[{ label: 'Create', href: '/me/communities/1', replace: true }]}
    />
  );
}
