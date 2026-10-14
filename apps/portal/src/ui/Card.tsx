import type { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** `plain` is the surface card; `dark` is the Baseball Card base (card.surface, 18 radius). */
  variant?: 'plain' | 'dark';
};

export function Card({ variant = 'plain', className, ...rest }: CardProps) {
  return (
    <div {...rest} className={`ti-card ti-card--${variant}${className ? ` ${className}` : ''}`} />
  );
}
