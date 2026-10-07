// Building blocks shared by the mobile app screens.
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { Back, Icon, Sheet } from '../shared/ui';
import { useApp } from './state';
import { initials, roleColor, splitDate } from './model';
import type { EventItem, Post } from '../shared/data';

/** Full-height phone screen with the standard padding. */
export function Screen({
  children,
  tabs,
  className = '',
  style,
}: {
  children: ReactNode;
  tabs?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={'m-screen screen ' + (tabs ? 'tabs ' : '') + className} style={style}>
      {children}
    </div>
  );
}

/** Renders children into the phone's overlay layer (above the scroller, below nothing). */
export function PhoneLayer({ children }: { children: ReactNode }) {
  const { layer } = useApp();
  return layer ? createPortal(children, layer) : null;
}

export const PhoneSheet = (p: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) =>
  p.open ? (
    <PhoneLayer>
      <Sheet {...p} />
    </PhoneLayer>
  ) : null;

export function PhoneDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <PhoneLayer>
      <button className="scrim" aria-label="Close" onClick={onClose} style={{ zIndex: 5 }} />
      <div className="phone-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="display d-32">{title}</h2>
        {children}
      </div>
    </PhoneLayer>
  );
}

export const BackBtn = ({ label = 'Back', light }: { label?: string; light?: boolean }) => {
  const { nav } = useApp();
  return <Back onClick={nav.back} label={label} light={light} />;
};

export const Title = ({
  children,
  size = 40,
  color,
}: {
  children: ReactNode;
  size?: 24 | 28 | 32 | 36 | 40 | 44 | 48 | 56;
  color?: string;
}) => (
  <h1 className={'display d-' + size} style={color ? { color } : undefined}>
    {children}
  </h1>
);

export const Head = ({
  eyebrow,
  title,
  red = true,
  size = 40,
  sub,
}: {
  eyebrow?: string;
  title: ReactNode;
  red?: boolean;
  size?: 32 | 36 | 40 | 44;
  sub?: ReactNode;
}) => (
  <div className="stack g4">
    {eyebrow && <div className={'eyebrow ' + (red ? 'red' : 'navy')}>{eyebrow}</div>}
    <Title size={size}>{title}</Title>
    {sub && (
      <p className="body" style={{ fontSize: 15 }}>
        {sub}
      </p>
    )}
  </div>
);

/** Cancel · Title · Action bar used by composers and editors. */
export function ModalBar({
  title,
  onCancel,
  action,
}: {
  title: string;
  onCancel: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="row between" style={{ minHeight: 44 }}>
      <button className="btn-ghost btn" style={{ padding: 0 }} onClick={onCancel}>
        Cancel
      </button>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      {action ?? <span style={{ width: 56 }} />}
    </div>
  );
}

/** Mutually exclusive option buttons (role grid, visibility, etc.). */
export function Options<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
  center,
}: {
  options: { id: T; name: string; sub?: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
  center?: boolean;
}) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={'choice' + (center ? ' c' : '')}
          aria-pressed={!o.disabled && o.id === value}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
        >
          <span style={{ fontSize: center ? 15 : 16, fontWeight: 600 }}>{o.name}</span>
          {o.sub && <span className="s">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div
      className="seg"
      role="tablist"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const InkChip = ({
  on,
  onClick,
  children,
  sm,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  sm?: boolean;
}) => (
  <button
    type="button"
    className={'inkchip' + (sm ? ' sm' : '')}
    aria-pressed={on}
    onClick={onClick}
  >
    {children}
  </button>
);

export const Circle = ({
  name,
  color,
  size = 36,
}: {
  name: string;
  color?: string;
  size?: number;
}) => (
  <span
    className="avatar"
    aria-hidden="true"
    style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? 'var(--navy)' }}
  >
    {initials(name)}
  </span>
);

export const Notice = ({
  children,
  tone = 'tint',
  icon = 'info',
}: {
  children: ReactNode;
  tone?: 'tint' | 'warn' | 'ok';
  icon?: string;
}) => (
  <div
    className={tone === 'tint' ? 'tint' : tone === 'ok' ? 'notice-ok' : 'notice-warn'}
    style={{
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      fontWeight: tone === 'ok' ? 600 : 400,
    }}
  >
    <Icon name={icon} size={18} style={{ flexShrink: 0, marginTop: 1 }} />
    <div>{children}</div>
  </div>
);

export const Err = ({ children }: { children: ReactNode }) =>
  children ? (
    <div className="err-text" role="alert">
      {children}
    </div>
  ) : null;

export function DateBox({ date, strong }: { date: string; strong?: boolean }) {
  const { month, day } = splitDate(date);
  return (
    <div
      className="datebox"
      style={
        strong
          ? { background: 'var(--navy)', color: '#fff' }
          : { background: 'var(--line-soft)', color: 'var(--ink)' }
      }
    >
      <div className="mo">{month}</div>
      <div className="dy">{day}</div>
    </div>
  );
}

export function EventRow({ e, onOpen }: { e: EventItem; onOpen: () => void }) {
  return (
    <button
      className="card-row"
      onClick={onOpen}
      style={{ alignItems: 'stretch', padding: 14, borderRadius: 16 }}
    >
      <DateBox date={e.date} strong={e.rsvp} />
      <span className="stack g4 grow">
        <span style={{ fontSize: 16, fontWeight: 600 }}>{e.title}</span>
        <span className="small">
          {e.date.split(',')[0]} · {e.time} · {e.place}
        </span>
        <span className="tiny">
          By {e.host} · {e.hostRole}
          {e.scope !== 'Everyone' ? ' · Team only' : ''}
        </span>
      </span>
      {e.rsvp && (
        <span className="pill pill-ok" style={{ alignSelf: 'flex-start' }}>
          Going
        </span>
      )}
    </button>
  );
}

/** Feed card for a post. */
export function PostCard({
  p,
  liked,
  onLike,
  onOpen,
  groupName,
  compact,
}: {
  p: Post;
  liked: boolean;
  onLike: () => void;
  onOpen: () => void;
  groupName?: string;
  compact?: boolean;
}) {
  if (p.official) {
    return (
      <button
        onClick={onOpen}
        className="stack g8"
        style={{
          background: 'var(--navy)',
          color: '#fff',
          borderRadius: 16,
          padding: 16,
          border: 0,
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span className="row g8">
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img src="./logo.png" alt="" style={{ width: 22 }} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Team IMPACT</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.1em',
              background: 'var(--ground)',
              color: 'var(--ink)',
              borderRadius: 999,
              padding: '3px 8px',
            }}
          >
            ANNOUNCEMENT
          </span>
        </span>
        <span style={{ fontSize: 16, lineHeight: 1.4 }}>{p.text}</span>
      </button>
    );
  }
  const where = groupName ? groupName + ' group' : p.scope === 'team' ? 'Team only' : 'Network';
  return (
    <article className="panel stack g10" style={{ padding: '14px 16px' }}>
      <button
        onClick={onOpen}
        className="stack g10"
        style={{
          border: 0,
          background: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--ink)',
          font: 'inherit',
        }}
      >
        <span className="row g10">
          <Circle name={p.author} color={roleColor(p.role)} />
          <span className="stack grow" style={{ gap: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{p.author}</span>
            <span className="tiny">
              {p.role} · {where} · {p.time}
            </span>
          </span>
        </span>
        <span style={{ fontSize: 15, lineHeight: 1.45 }}>{p.text}</span>
      </button>
      {!compact && (
        <div className="row g10">
          <button
            className="btn btn-sm btn-quiet"
            aria-pressed={liked}
            onClick={onLike}
            style={liked ? { borderColor: 'var(--red)', color: '#B3182F' } : undefined}
          >
            <Icon name="heart" size={16} />
            Rally · {p.likes}
          </button>
          <button className="btn btn-sm btn-quiet" onClick={onOpen}>
            <Icon name="comment" size={16} />
            {p.comments.length} {p.comments.length === 1 ? 'comment' : 'comments'}
          </button>
        </div>
      )}
    </article>
  );
}

/** A simple QR-like grid (decorative; real codes come from the API). */
export function FakeQR({ size = 13, cell = 10 }: { size?: number; cell?: number }) {
  const cells: boolean[] = [];
  const finder = (r: number, c: number) => {
    const box = (r0: number, c0: number) => r >= r0 && r < r0 + 4 && c >= c0 && c < c0 + 4;
    return box(0, 0) || box(0, size - 4) || box(size - 4, 0);
  };
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const inner =
        (r % (size - 4) === 1 || r % (size - 4) === 2) &&
        (c % (size - 4) === 1 || c % (size - 4) === 2);
      cells.push(finder(r, c) ? !inner : (r * 7 + c * 11 + r * c) % 3 === 0);
    }
  return (
    <div
      role="img"
      aria-label="Team join QR code"
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: 14,
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, ${cell}px)`,
        gap: 1,
      }}
    >
      {cells.map((on, i) => (
        <div
          key={i}
          style={{ width: cell, height: cell, background: on ? 'var(--ink)' : '#fff' }}
        />
      ))}
    </div>
  );
}

/** Icons the shared set does not have. */
export const PhoneIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  </svg>
);
