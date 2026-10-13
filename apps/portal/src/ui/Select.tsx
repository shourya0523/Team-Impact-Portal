import { useId, type SelectHTMLAttributes } from 'react';
import { Text } from './Text';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'style'> & {
  label: string;
};

/** Labelled native select, styled like `Input` (same field, border and focus states). */
export function Select({ label, id, children, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className="ti-field">
      <Text as="label" variant="small" weight="medium" color="secondary" htmlFor={selectId}>
        {label}
      </Text>
      <select {...rest} id={selectId} className="ti-input">
        {children}
      </select>
    </div>
  );
}
