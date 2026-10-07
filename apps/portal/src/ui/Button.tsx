import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  /** md = 52, lg = 56. */
  size?: 'md' | 'lg';
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
