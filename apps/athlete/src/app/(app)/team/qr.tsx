import { Placeholder } from '@/components/Placeholder';

/** "/team/qr" */
export default function CoachQR() {
  return (
    <Placeholder
      title="Coach: QR code"
      wireframe="A-28/29"
      links={[{ label: 'Back to team', href: '/team', replace: true }]}
    />
  );
}
