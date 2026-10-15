import { colors } from '@team-impact/ui-tokens';

/** Colours a recruiter can tag a list with: token values, stored on the list as hex. */
export const LIST_COLORS = [
  { label: 'Navy', value: colors.brand },
  { label: 'Red', value: colors.action },
  { label: 'Purple', value: colors.role.parent },
  { label: 'Green', value: colors.role.recruiter },
  { label: 'Teal', value: colors.role.alumni },
  { label: 'Black', value: colors.role.coach },
];
