import { Placeholder } from '@/components/Placeholder';

/** "/card/history" */
export default function CardHistory() {
  return (
    <Placeholder
      title="Card history by season"
      wireframe="A9"
      links={[{ label: 'Back to my card', href: '/card', replace: true }]}
    />
  );
}
