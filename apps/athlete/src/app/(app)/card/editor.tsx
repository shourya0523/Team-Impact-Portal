import { Placeholder } from '@/components/Placeholder';

/** "/card/editor" */
export default function CardEditor() {
  return (
    <Placeholder
      title="Card editor"
      wireframe="A-35"
      links={[{ label: 'Save card', href: '/card', replace: true }]}
    />
  );
}
