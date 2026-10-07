import { useId, type InputHTMLAttributes } from 'react';
import { Text } from './Text';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> & {
  label: string;
  /** Shown under the field on a warning chip. Never rely on colour alone. */
  error?: string;
};

/** States: default, focus (brand ring), error, disabled. */
export function Input({ label, error, id, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  return (
    <div className="ti-field">
      <Text as="label" variant="small" weight="medium" color="secondary" htmlFor={inputId}>
        {label}
      </Text>
      <input
        {...rest}
        id={inputId}
        className="ti-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="ti-error ti-text ti-text--caption ti-weight--medium"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
