import { Placeholder } from '@/components/Placeholder';

/** "/card/upload" */
export default function UploadResume() {
  return (
    <Placeholder
      title="Upload resume"
      wireframe="A-33"
      links={[
        { label: 'Review extracted fields', href: '/card/review' },
        { label: 'Fill in manually', href: '/card/editor' },
      ]}
    />
  );
}
