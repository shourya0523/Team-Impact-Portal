import { Placeholder } from '@/components/Placeholder';

/** "/card/export" */
export default function ExportCard() {
  return (
    <Placeholder
      title="Export card as image"
      wireframe="A8"
      links={[{ label: 'Done', href: '/card', replace: true }]}
    />
  );
}
