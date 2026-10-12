import { Placeholder } from '@/components/Placeholder';

/** "/team/remove" */
export default function RemoveMember() {
  return (
    <Placeholder
      title="Remove member (confirm)"
      wireframe="C3"
      links={[{ label: 'Remove', href: '/team', replace: true }]}
    />
  );
}
