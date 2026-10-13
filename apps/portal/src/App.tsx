import { colors, fontSize, spacing } from '@team-impact/ui-tokens';
import { AthleteCardPreview } from './AthleteCardPreview';

/** Portal shell for recruiters and Team Impact staff. Routes land in later tickets. */
export const App = () => (
  <main
    style={{
      fontFamily: 'system-ui, sans-serif',
      color: colors.text,
      background: colors.background,
      padding: spacing.xl,
    }}
  >
    <h1 style={{ fontSize: fontSize.xl, color: colors.primary }}>Team Impact Portal</h1>
    <p style={{ color: colors.textMuted }}>Recruiter and staff portal.</p>
    <AthleteCardPreview />
  </main>
);
