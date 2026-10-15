import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../shared/ui';

/** Big page title with optional right-side action, as in the canvas (48px display, action pushed right). */
export function PageHead({
  title,
  eyebrow,
  action,
  size = 48,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  size?: number;
}) {
  return (
    <div className="row wrap g12" style={{ alignItems: 'flex-end' }}>
      <div className="stack g4">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="display" style={{ fontSize: size, lineHeight: 1 }}>
          {title}
        </h1>
      </div>
      {action && (
        <div className="row g8 wrap" style={{ marginLeft: 'auto' }}>
          {action}
        </div>
      )}
    </div>
  );
}

export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="display d-24" style={{ lineHeight: 1 }}>
    {children}
  </h2>
);

export const Box = ({
  children,
  gap = 10,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) => (
  <section className="panel stack" style={{ padding: 18, gap, ...style }}>
    {children}
  </section>
);

export const Kicker = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '.1em',
      color: 'var(--muted)',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="panel" style={{ padding: 16, borderRadius: 14 }}>
      <div className="tiny">{label}</div>
      <div className="display" style={{ fontSize: 40, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div className="tiny">{sub}</div>}
    </div>
  );
}

export const StatGrid = ({ children, min = 170 }: { children: ReactNode; min?: number }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      gap: 12,
    }}
  >
    {children}
  </div>
);

/** Text-styled link button used for row names in tables. */
export const LinkBtn = ({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    style={{
      border: 0,
      background: 'none',
      padding: 0,
      minHeight: 32,
      color: 'var(--navy)',
      fontWeight: 600,
      fontSize: 15,
      cursor: 'pointer',
      textAlign: 'left',
    }}
  >
    {children}
  </button>
);

/** Removable token (email domain). */
export const Token = ({
  children,
  onRemove,
  label,
}: {
  children: ReactNode;
  onRemove?: () => void;
  label: string;
}) => (
  <span
    className="row g4"
    style={{
      height: 36,
      padding: '0 6px 0 12px',
      borderRadius: 999,
      background: 'var(--navy-tint)',
      color: 'var(--navy-pressed)',
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    {children}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        style={{
          width: 28,
          height: 28,
          border: 0,
          borderRadius: 999,
          background: 'transparent',
          color: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name="close" size={14} />
      </button>
    )}
  </span>
);

/** In-page two-step confirmation panel. */
export function Confirm({
  title,
  children,
  yes,
  onYes,
  onNo,
  danger = true,
}: {
  title: string;
  children?: ReactNode;
  yes: string;
  onYes: () => void;
  onNo: () => void;
  danger?: boolean;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={title}
      className="panel stack g10 rise"
      style={{
        padding: 18,
        borderColor: danger ? 'var(--danger)' : 'var(--navy)',
        borderWidth: 1.5,
        animationDelay: '0ms',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
      {children && <div className="small">{children}</div>}
      <div className="row g8 wrap">
        <button className={'btn ' + (danger ? 'btn-danger' : 'btn-navy')} onClick={onYes}>
          {yes}
        </button>
        <button className="btn btn-quiet" onClick={onNo}>
          Cancel
        </button>
      </div>
    </div>
  );
}
