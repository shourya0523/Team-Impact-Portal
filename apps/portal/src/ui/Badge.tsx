export type BadgeProps = {
  label: string;
  variant?: 'neutral' | 'brand' | 'warning';
};

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return <span className={`ti-badge ti-badge--${variant}`}>{label}</span>;
}
