import { Placeholder } from '@/components/Placeholder';

/** "/onboarding/find-team" */
export default function FindTeam() {
  return (
    <Placeholder
      title="Find your team"
      wireframe="A-07/08"
      links={[
        { label: 'Request to join', href: '/onboarding/request' },
        { label: 'Scan a team QR code', href: '/scan' },
      ]}
    />
  );
}
