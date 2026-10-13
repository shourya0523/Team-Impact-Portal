/**
 * A token colour at reduced opacity, as 8-digit hex (#RRGGBBAA, supported on native and web).
 * For shadows and scrims only; text and controls use solid tokens so contrast stays testable.
 */
export function withAlpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
