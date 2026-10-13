import { Placeholder } from '@/components/Placeholder';

/** "/team/add-coach" */
export default function AddCoach() {
  return (
    <Placeholder
      title="Add a coach"
      wireframe="C4"
      links={[{ label: 'Send invite', href: '/team', replace: true }]}
    />
  );
}
