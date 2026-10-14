import { Placeholder } from '@/components/Placeholder';

/** "/me/alumni" */
export default function AlumniBrowse() {
  return (
    <Placeholder
      title="Browse alumni"
      wireframe="A7"
      links={[{ label: 'An alumni profile', href: '/me/alumni/1' }]}
    />
  );
}
