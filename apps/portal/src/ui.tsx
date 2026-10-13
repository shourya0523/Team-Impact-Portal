import type { CSSProperties, ReactNode } from 'react';
import { cardColors } from '@team-impact/ui-primitives/web';
import { colors, fontSize, radius, spacing } from '@team-impact/ui-tokens';
import type { Loadable } from './useApi';

/**
 * The portal's few building blocks. Colours come from the shared tokens and the card's brand
 * palette (navy, red, off-white), matching the hi-fi mockups in apps/mockups, so feature tickets
 * restyle in one place.
 */
export const brand = {
  navy: cardColors.navy,
  navyDeep: cardColors.navyDeep,
  // The tokens' red (#fd002b) is too light for white text (3.9:1); this one is 5.3:1, as in the
  // mockups. TODO(token decision): move into ui-tokens once the lead picks a token set.
  red: '#d0213c',
  page: cardColors.offWhite,
  surface: colors.background,
  ink: cardColors.ink,
  muted: colors.textMuted,
  border: colors.border,
} as const;

export const PageHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) => (
  <header
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <h1
        style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          color: brand.navy,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: `${spacing.xs}px 0 0`, color: brand.muted, fontSize: fontSize.sm }}>
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </header>
);

export const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <section
    style={{
      background: brand.surface,
      border: `1px solid ${brand.border}`,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </section>
);

export interface Column<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
  width?: number | string;
  align?: 'left' | 'right';
}

export const Table = <Row,>({
  columns,
  rows,
  rowKey,
  empty = 'Nothing here yet.',
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: string;
}) => (
  <Panel>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.sm }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.header}
              scope="col"
              style={{
                textAlign: c.align ?? 'left',
                width: c.width,
                padding: `${spacing.sm + 4}px ${spacing.md}px`,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: brand.muted,
                borderBottom: `1px solid ${brand.border}`,
              }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} style={{ padding: spacing.lg, color: brand.muted }}>
              {empty}
            </td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c) => (
              <td
                key={c.header}
                style={{
                  textAlign: c.align ?? 'left',
                  padding: `${spacing.sm + 6}px ${spacing.md}px`,
                  borderBottom: `1px solid ${brand.border}`,
                  color: brand.ink,
                  verticalAlign: 'middle',
                }}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </Panel>
);

const TONES = {
  neutral: { background: '#EEF0F3', color: '#374151' },
  good: { background: '#E3F4EA', color: '#11643A' },
  warn: { background: '#FFF4D6', color: '#7A5200' },
  danger: { background: '#FDE7EA', color: '#A1122B' },
  info: { background: '#E7EDFB', color: brand.navy },
} as const;

export const Badge = ({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) => (
  <span
    style={{
      ...TONES[tone],
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: radius.pill,
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

export const button = (kind: 'primary' | 'secondary' | 'quiet' = 'primary'): CSSProperties => ({
  minHeight: 36,
  padding: `0 ${spacing.md}px`,
  borderRadius: radius.pill,
  fontSize: fontSize.sm,
  fontWeight: 700,
  cursor: 'pointer',
  border: kind === 'secondary' ? `1px solid ${brand.navy}` : 'none',
  background: kind === 'primary' ? brand.red : kind === 'secondary' ? brand.surface : 'transparent',
  color: kind === 'primary' ? '#FFFFFF' : brand.navy,
});

/** Renders loading and error states the same way on every page. */
export const Async = <T,>({
  state,
  children,
}: {
  state: Loadable<T>;
  children: (data: T) => ReactNode;
}) => {
  if (state.status === 'loading') {
    return (
      <p role="status" style={{ color: brand.muted }}>
        Loading…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p role="alert" style={{ color: colors.danger }}>
        Couldn’t load this: {state.error.message}
      </p>
    );
  }
  return <>{children(state.data)}</>;
};

export const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`;

export const initials = (p: { firstName: string; lastName: string }) =>
  `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Square tile with initials or a jersey number, like the mockups' team and result rows. */
export const Tile = ({
  text,
  color = brand.navy,
  size = 32,
}: {
  text: string;
  color?: string;
  size?: number;
}) => (
  <span
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: 8,
      background: color,
      color: '#FFFFFF',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.36,
      fontWeight: 800,
    }}
  >
    {text}
  </span>
);
