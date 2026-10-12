import { Placeholder } from '@/components/Placeholder';

/** "/me/recruiting" */
export default function Recruiting() {
  return (
    <Placeholder
      title="Contacts and recruiting"
      wireframe="A-40/41/42"
      links={[{ label: 'Back to Me', href: '/me', replace: true }]}
    />
  );
}
