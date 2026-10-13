import { Pressable, StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { Text } from '@/ui';

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
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={styles.text}>
        <Text weight="semibold">{label}</Text>
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
