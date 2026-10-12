import { Placeholder } from '@/components/Placeholder';

/** "/lists" */
export default function RecruiterLists() {
  return (
    <Placeholder
      title="Recruiter lists"
      wireframe="A-50"
      links={[
        { label: 'An athlete card', href: '/review/athletes/1' },
        { label: 'New list', href: '/lists/new' },
      ]}
    />
  );
}
