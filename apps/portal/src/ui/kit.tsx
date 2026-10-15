import type { ReactNode } from 'react';
import {
  colors,
  fontFamily,
  fontWeight,
  layout,
  onTeamColor,
  radius,
  resolveTeamColor,
  spacing,
  typography,
} from '@team-impact/ui-tokens';
import type { Loadable } from '../useApi';
import { Card } from './Card';
import { Text } from './Text';

/**
 * Portal-level composites built on the Signing Day primitives: page header, data table, loading
 * states and the square jersey tile. Feature pages restyle through these, not inline values.
 */

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      <Text variant="display" size="sm" color="brand">
        {title}
      </Text>
      {subtitle && (
        <Text variant="small" color="muted">
          {subtitle}
        </Text>
      )}
    </div>
    {action}
  </header>
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
  <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: typography.small.fontSize,
        lineHeight: `${typography.small.lineHeight}px`,
      }}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.header}
              scope="col"
              className="ti-text ti-text--eyebrow ti-color--muted"
              style={{
                textAlign: c.align ?? 'left',
                width: c.width,
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderBottom: `1px solid ${colors.line}`,
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
            <td colSpan={columns.length} style={{ padding: spacing.lg, color: colors.text.muted }}>
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
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  height: layout.minTouchTarget,
                  borderBottom: `1px solid ${colors.lineSoft}`,
                  color: colors.ink,
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
  </Card>
);

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
      <Text role="status" color="muted">
        Loading…
      </Text>
    );
  }
  if (state.status === 'error') {
    return (
      <Text role="alert" color="danger">
        Couldn’t load this: {state.error.message}
      </Text>
    );
  }
  return <>{children(state.data)}</>;
};

export const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const TILE = {
  sm: { size: layout.avatar.sm, fontSize: typography.small.fontSize },
  md: { size: layout.avatar.md, fontSize: typography.display.xs.fontSize },
} as const;

/**
 * Square tile with a jersey number or team monogram, on the team's runtime colour (brand when it
 * has none). Text flips between white and ink to stay AA-legible. Decorative: the name sits beside it.
 */
export const Tile = ({
  text,
  teamColor,
  size = 'sm',
}: {
  text: string;
  teamColor?: string | null;
  size?: keyof typeof TILE;
}) => {
  const bg = resolveTeamColor(teamColor);
  const { size: px, fontSize } = TILE[size];
  return (
    <span
      aria-hidden="true"
      style={{
        width: px,
        height: px,
        flexShrink: 0,
        borderRadius: radius.sm,
        background: bg,
        color: onTeamColor(bg),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: fontFamily.display,
        fontSize,
        fontWeight: fontWeight.display,
      }}
    >
      {text}
    </span>
  );
};
