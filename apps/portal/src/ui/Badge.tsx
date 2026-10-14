export type BadgeProps = {
  label: string;
  /** Each pair is covered by the token contrast test (`textPairs`). */
  variant?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';
};

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return <span className={`ti-badge ti-badge--${variant}`}>{label}</span>;
}
