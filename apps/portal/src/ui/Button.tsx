import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  /** `quiet` is a text-only brand button for low-emphasis actions such as "Clear filters". */
  variant?: 'primary' | 'secondary' | 'quiet';
  /** sm = 44 (inside cards and table rows), md = 52, lg = 56. */
  size?: 'sm' | 'md' | 'lg';
};

/** States: default, hover, pressed, focus-visible, disabled. */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={`ti-button ti-button--${variant} ti-button--${size}`}>
      {label}
    </button>
  );
}
