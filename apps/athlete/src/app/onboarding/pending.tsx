import { Placeholder } from '@/components/Placeholder';

/** "/onboarding/pending" */
export default function Pending() {
  return (
    <Placeholder
      title="Request pending"
      wireframe="A-10"
      links={[{ label: 'Scan a team QR code instead', href: '/scan' }]}
    />
  );
}
