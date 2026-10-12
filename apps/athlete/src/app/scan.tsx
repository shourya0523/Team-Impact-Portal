import { Placeholder } from '@/components/Placeholder';

/** "/scan" */
export default function ScanQR() {
  return (
    <Placeholder
      title="Scan a team QR code"
      wireframe="A-11"
      links={[
        { label: 'Scanned: join the team', href: '/signed' },
        { label: 'Back to welcome', href: '/welcome', replace: true },
      ]}
    />
  );
}
