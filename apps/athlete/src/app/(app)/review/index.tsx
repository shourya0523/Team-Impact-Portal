import { Placeholder } from '@/components/Placeholder';

/** "/review" */
export default function QuickReview() {
  return (
    <Placeholder
      title="Quick review"
      wireframe="A-49"
      links={[
        { label: 'An athlete card', href: '/review/athletes/1' },
        { label: 'Filters', href: '/review/filters' },
      ]}
    />
  );
}
