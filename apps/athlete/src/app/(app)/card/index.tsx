import { Placeholder } from '@/components/Placeholder';

/** "/card" */
export default function CardHome() {
  return (
    <Placeholder
      title="My card"
      wireframe="A-32 start / A-32/36 my card"
      links={[
        { label: 'Upload resume', href: '/card/upload' },
        { label: 'Build it manually', href: '/card/editor' },
        { label: 'Export card', href: '/card/export' },
        { label: 'Card history', href: '/card/history' },
      ]}
    />
  );
}
