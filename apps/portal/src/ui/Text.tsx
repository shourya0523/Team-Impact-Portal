import type { ElementType, HTMLAttributes } from 'react';

export type TextProps = HTMLAttributes<HTMLElement> & {
  variant?: 'display' | 'body' | 'small' | 'caption' | 'eyebrow';
  /** Display size step; ignored for other variants. */
  size?: 'xl' | 'lg' | 'md' | 'sm';
  /** UI weight; ignored for display (always 800) and eyebrow (always 600). */
  weight?: 'regular' | 'medium' | 'semibold';
  color?: 'ink' | 'secondary' | 'muted' | 'brand' | 'on-brand';
  /** Element to render. Defaults: h1 for display, p otherwise. */
  as?: ElementType;
  /** Passed through when rendering as a <label>. */
  htmlFor?: string;
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** The only way to render text. Maps the Signing Day type tokens onto CSS classes. */
export function Text({
  variant = 'body',
  size = 'md',
  weight = 'regular',
  color = 'ink',
  as,
  className,
  ...rest
}: TextProps) {
  const Tag = as ?? (variant === 'display' ? 'h1' : 'p');
  return (
    <Tag
      {...rest}
      className={cx(
        'ti-text',
        variant === 'display' ? `ti-text--display ti-text--display-${size}` : `ti-text--${variant}`,
        (variant === 'body' || variant === 'small' || variant === 'caption') &&
          `ti-weight--${weight}`,
        `ti-color--${color}`,
        className,
      )}
    />
  );
}
