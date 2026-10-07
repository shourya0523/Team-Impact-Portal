/**
 * Accessibility constraints from the ticket + Team Impact design system.
 */
export const accessibility = {
  minTouchTarget: 44,
  contrast: {
    normalText: 4.5,
    largeText: 3,
  },
} as const;

/**
 * Pairings approved by the Figma design system for normal text/UI content.
 *
 * Red (#fd002b) is an accent/decorative color, not an approved normal-text
 * foreground on white because its contrast ratio is below 4.5:1.
 */
export const approvedColorPairings = [
  {
    name: 'navy-on-white',
    foreground: '#1e4079',
    background: '#ffffff',
  },
  {
    name: 'blue-on-white',
    foreground: '#0f407f',
    background: '#ffffff',
  },
  {
    name: 'ink-on-white',
    foreground: '#1c1c1c',
    background: '#ffffff',
  },
  {
    name: 'navy-on-yellow',
    foreground: '#1e4079',
    background: '#ffda00',
  },
  {
    name: 'ink-on-off-white',
    foreground: '#1c1c1c',
    background: '#f5f7fb',
  },
  {
    name: 'ink-on-light-blue',
    foreground: '#1c1c1c',
    background: '#c4daeb',
  },
] as const;
