import { Placeholder } from '@/components/Placeholder';

/** "/team/edit" */
export default function EditTeam() {
  return (
    <Placeholder
      title="Edit team details"
      wireframe="C5"
      links={[{ label: 'Save', href: '/team', replace: true }]}
    />
  );
}
