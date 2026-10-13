import { Placeholder } from '@/components/Placeholder';

/** "/card/review" */
export default function CardReview() {
  return (
    <Placeholder
      title="Review extracted fields"
      wireframe="A-34"
      links={[
        { label: 'Looks good: publish', href: '/card', replace: true },
        { label: 'Edit manually', href: '/card/editor' },
      ]}
    />
  );
}
