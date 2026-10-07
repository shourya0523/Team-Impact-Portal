import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { Athlete, Team } from './data';

/* ---------- icons (inline stroke SVG, 24 grid) ---------- */
const P: Record<string, string> = {
  back: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  events: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  team: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a2.5 2.5 0 100-5M18 14c2 .7 3 2.6 3 6',
  card: 'M6 3h12v18H6zM9 16h6M9 13h4',
  me: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  review: 'M7 4h10v16H7zM4 7v10M20 7v10',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
  bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20h4',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  comment: 'M4 5h16v11H8l-4 4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 100-6 3 3 0 000 6z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  check: 'M5 12l5 5 9-10',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  users:
    'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a2.5 2.5 0 100-5M18 14c2 .7 3 2.6 3 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  share: 'M16 6l-4-4-4 4M12 2v14M5 12v8h14v-8',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  megaphone: 'M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 010 6',
  building: 'M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2',
  swipe: 'M7 4h10v16H7z',
};
export function Icon({
  name,
  size = 20,
  stroke = 2,
  style,
}: {
  name: keyof typeof P | string;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={P[name] ?? P.info} />
    </svg>
  );
}

export const Logo = ({ size = 34, boxed = false }: { size?: number; boxed?: boolean }) =>
  boxed ? (
    <span style={{ background: '#fff', borderRadius: 10, padding: 5, display: 'inline-flex' }}>
      <img
        src="/logo.png"
        alt="Team IMPACT"
        style={{ width: size, height: 'auto', display: 'block' }}
      />
    </span>
  ) : (
    <img
      src="/logo.png"
      alt="Team IMPACT"
      style={{ width: size, height: 'auto', display: 'block' }}
    />
  );

export const Back = ({
  onClick,
  label = 'Back',
  light = false,
}: {
  onClick: () => void;
  label?: string;
  light?: boolean;
}) => (
  <button className="back" onClick={onClick} style={light ? { color: '#fff' } : undefined}>
    <Icon name="back" size={18} />
    {label}
  </button>
);

export function Field({
  label,
  optional,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="opt"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <div className="tiny">{hint}</div>}
      {error && (
        <div className="err-text" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export const Switch = ({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    className="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  />
);

export function SwitchRow({
  title,
  sub,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="row between g12" style={{ padding: '12px 14px' }}>
      <div className="stack g4">
        <div
          style={{ fontSize: 15, fontWeight: 600, color: disabled ? 'var(--muted)' : undefined }}
        >
          {title}
        </div>
        {sub && <div className="tiny">{sub}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export const Chip = ({
  on,
  onClick,
  children,
  small,
}: {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
  small?: boolean;
}) => (
  <button
    type="button"
    className={'chip' + (small ? ' chip-sm' : '')}
    aria-pressed={!!on}
    onClick={onClick}
  >
    {children}
  </button>
);

export const Pill = ({
  tone = 'navy',
  children,
}: {
  tone?: 'navy' | 'ok' | 'warn' | 'red' | 'gray';
  children: ReactNode;
}) => <span className={'pill pill-' + tone}>{children}</span>;

export const Tile = ({
  team,
  size = 44,
}: {
  team: Pick<Team, 'abbr' | 'color'>;
  size?: number;
}) => (
  <span
    className="tile"
    style={{ width: size, height: size, background: team.color, fontSize: size * 0.4 }}
  >
    {team.abbr}
  </span>
);

export const Avatar = ({
  name,
  color = 'var(--navy)',
  size = 40,
}: {
  name: string;
  color?: string;
  size?: number;
}) => (
  <span
    className="avatar"
    style={{ background: color, width: size, height: size, fontSize: size * 0.36 }}
    aria-hidden="true"
  >
    {name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')}
  </span>
);

/** Toast: const [toast, show] = useToast(); ... {toast} */
export function useToast(fixed = false): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  const t = useRef<number | undefined>(undefined);
  const show = (m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(''), 1800);
  };
  useEffect(() => () => window.clearTimeout(t.current), []);
  return [
    msg ? (
      <div key={msg} className={'toast' + (fixed ? ' fixed' : '')} role="status">
        {msg}
      </div>
    ) : null,
    show,
  ];
}

/** Bottom sheet inside a positioned parent (the phone). */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <button className="scrim" aria-label="Close" onClick={onClose} style={{ zIndex: 5 }} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

/** Centered dialog for the web apps. */
export function Modal({
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
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-wrap">
      <button className="scrim" aria-label="Close" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between g12">
          <h2 className="display d-36">{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The Baseball Card: flips on tap, tilts + shines under the pointer. */
export function BaseballCard({
  a,
  team,
  interactive = true,
  scale = 1,
  showNum = true,
}: {
  a: Pick<
    Athlete,
    | 'first'
    | 'last'
    | 'num'
    | 'position'
    | 'year'
    | 'major'
    | 'division'
    | 'exp'
    | 'skills'
    | 'looking'
    | 'hometown'
  >;
  team: Pick<Team, 'name' | 'college' | 'color'>;
  interactive?: boolean;
  scale?: number;
  showNum?: boolean;
}) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [t, setT] = useState({ rx: 0, ry: 0, x: 50, y: 50 });
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!interactive || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    setT({
      ry: Math.round((x - 0.5) * 18),
      rx: Math.round((0.5 - y) * 18),
      x: x * 100,
      y: y * 100,
    });
  };
  const style: CSSProperties = {
    transform: `perspective(900px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) scale(${scale})`,
    transformOrigin: 'top center',
    marginBottom: scale < 1 ? (scale - 1) * 340 : 0,
  };
  return (
    <button
      className="bcard"
      style={style}
      aria-label={`${a.first} ${a.last}'s card, ${side} side. Tap to flip`}
      onClick={() => interactive && setSide((s) => (s === 'front' ? 'back' : 'front'))}
      onPointerMove={move}
      onPointerLeave={() => setT({ rx: 0, ry: 0, x: 50, y: 50 })}
      tabIndex={interactive ? 0 : -1}
    >
      <div className="stripe" style={{ background: team.color }} />
      {side === 'front' ? (
        <>
          <div className="photo">
            Athlete photo
            {showNum && <div className="num">{a.num}</div>}
            <img
              src="/logo.png"
              alt=""
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 30,
                background: '#fff',
                borderRadius: 6,
                padding: 3,
              }}
            />
          </div>
          <div className="stack g10" style={{ padding: '12px 16px 14px' }}>
            <div>
              <div
                style={{
                  fontFamily: 'var(--display)',
                  fontWeight: 800,
                  fontSize: 30,
                  lineHeight: 0.95,
                  textTransform: 'uppercase',
                }}
              >
                {a.first} {a.last}
              </div>
              <div style={{ fontSize: 13, color: 'var(--on-navy)' }}>
                {a.position} · {team.name} · {team.college.replace(' University', '')}
              </div>
            </div>
            <div
              className="grid3"
              style={{ borderTop: '1px solid rgba(255,255,255,.18)', paddingTop: 10, gap: 6 }}
            >
              <div>
                <div className="k">CLASS</div>
                <div className="v">{a.year}</div>
              </div>
              <div>
                <div className="k">MAJOR</div>
                <div className="v">{a.major.split(',')[0]}</div>
              </div>
              <div>
                <div className="k">DIVISION</div>
                <div className="v">{a.division}</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="stack g10" style={{ padding: '18px 16px', flex: 1 }}>
          <div className="k">EXPERIENCE</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{a.exp}</div>
          <div className="k">SKILLS</div>
          <div style={{ fontSize: 15 }}>{a.skills}</div>
          <div className="k">LOOKING FOR</div>
          <div style={{ fontSize: 15 }}>{a.looking}</div>
          <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--on-navy-muted)' }}>
            Hometown {a.hometown} · Season 2026
          </div>
        </div>
      )}
      {interactive && !reduce && (
        <div
          className="shine"
          style={{
            background: `radial-gradient(circle at ${t.x}% ${t.y}%, rgba(255,255,255,.55), rgba(255,255,255,0) 45%)`,
          }}
        />
      )}
    </button>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="dashed stack g10"
      style={{ padding: '28px 20px', alignItems: 'center', textAlign: 'center' }}
    >
      <div className="display d-28">{title}</div>
      {children && (
        <div className="small" style={{ maxWidth: 360 }}>
          {children}
        </div>
      )}
      {action}
    </div>
  );
}
