import { Placeholder } from '@/components/Placeholder';

/** "/card/claim" */
export default function ClaimCard() {
  return (
    <Placeholder
      title="Claim your pre-built card"
      wireframe="L5"
      links={[{ label: 'Review the card', href: '/card/review' }]}
    />
  );
}
