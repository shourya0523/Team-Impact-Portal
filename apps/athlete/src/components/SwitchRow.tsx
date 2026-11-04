import { Pressable, StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { Badge, Text } from '@/ui';

const SWITCH_W = 56;
const SWITCH_H = 32;
const KNOB = 26;

/**
 * A labelled on/off switch row, like the community page's "Recruiters can find me" switch. The
 * whole row is the control (one target, no nested buttons).
 */
export function SwitchRow({
  label,
  detail,
  value,
  onChange,
  disabled,
  flag,
}: {
  label: string;
  detail?: string;
  /** A short warning badge beside the label, e.g. "Check" on a low-confidence resume field. */
  flag?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={flag ? `${label}, ${flag}` : label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={styles.text}>
        <View style={styles.label}>
          <Text weight="semibold">{label}</Text>
          {flag && <Badge caps variant="warning" label={flag} />}
        </View>
        {detail && (
          <Text variant="small" color="secondary">
            {detail}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.switch,
          {
            backgroundColor: value ? colors.brand : colors.text.muted,
            alignItems: value ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        <View style={styles.knob} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: { flex: 1, gap: spacing.xs },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  // Disabled controls are exempt from contrast rules; dimming marks them inactive.
  disabled: { opacity: 0.5 },
  switch: {
    width: SWITCH_W,
    height: SWITCH_H,
    borderRadius: SWITCH_H / 2,
    padding: (SWITCH_H - KNOB) / 2,
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.surface },
});
