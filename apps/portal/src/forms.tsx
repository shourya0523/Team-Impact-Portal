import {
  useId,
  useState,
  type FormEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { spacing } from '@team-impact/ui-tokens';
import { Text } from './ui';

/**
 * Small helpers for the portal's write forms (staff tools, recruiter lists): one busy flag and
 * one error line per action, a labelled textarea, and a form laid out like the sheet content.
 */
export const useAction = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    return action()
      .then(() => after?.())
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return { busy, error, setError, run };
};

export const FormError = ({ children }: { children: ReactNode }) =>
  children ? (
    <Text role="alert" variant="small" weight="medium" color="danger">
      {children}
    </Text>
  ) : null;

export const Form = ({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) => (
  <form
    onSubmit={(e: FormEvent) => {
      e.preventDefault();
      onSubmit();
    }}
    style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
  >
    {children}
  </form>
);

export const Actions = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'inline-flex', gap: spacing.sm, flexWrap: 'wrap' }}>{children}</div>
);

export const Textarea = ({
  label,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style'> & {
  label: string;
}) => {
  const id = useId();
  return (
    <div className="ti-field">
      <Text as="label" variant="small" weight="medium" color="secondary" htmlFor={id}>
        {label}
      </Text>
      <textarea {...rest} id={id} rows={rest.rows ?? 4} className="ti-input" />
    </div>
  );
};

export const Checkbox = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <Text as="span" variant="small">
      {label}
    </Text>
  </label>
);
