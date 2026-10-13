import { Placeholder } from '@/components/Placeholder';

/** "/onboarding/under-13" */
export default function Under13() {
  return (
    <Placeholder
      title="A grown-up sets this one up"
      wireframe="A-04"
      links={[
        { label: 'Set up as a parent', href: '/sign-up', replace: true },
        { label: 'Back to welcome', href: '/welcome', replace: true },
      ]}
    />
  );
}
