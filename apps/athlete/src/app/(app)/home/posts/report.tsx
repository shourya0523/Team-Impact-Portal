import { Placeholder } from '@/components/Placeholder';

/** "/home/posts/report" */
export default function ReportPost() {
  return (
    <Placeholder
      title="Report: reason and next steps"
      wireframe="P5"
      links={[{ label: 'Submit report', href: '/home', replace: true }]}
    />
  );
}
