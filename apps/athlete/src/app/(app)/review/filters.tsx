import { Placeholder } from '@/components/Placeholder';

/** "/review/filters" */
export default function ReviewFilters() {
  return (
    <Placeholder
      title="Quick review filters"
      wireframe="R7"
      links={[{ label: 'Apply', href: '/review', replace: true }]}
    />
  );
}
