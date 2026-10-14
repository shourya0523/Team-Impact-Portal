import { Pressable, StyleSheet, View } from 'react-native';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { ApiRequestError } from '@/api';
import { Icon, Text } from '@/ui';

/** Composites for sign-up, joining by QR and accepting a coach invite. */

const BOX = 24;

/** A labelled checkbox: the whole row is the control. */
export function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked && <Icon name="check" size={16} color={colors.onBrand.text} strokeWidth={3} />}
      </View>
      <Text style={styles.grow}>{label}</Text>
    </Pressable>
  );
}

/** One choice in a single-select list (roles, sports). */
export function OptionRow({
  label,
  note,
  selected,
  onPress,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.option, selected && styles.optionOn]}
    >
      <View style={styles.grow}>
        <Text weight="semibold" color={selected ? 'brand' : 'ink'}>
          {label}
        </Text>
        {note && (
          <Text variant="caption" weight="medium" color="secondary">
            {note}
          </Text>
        )}
      </View>
      {selected && <Icon name="check" size={18} color={colors.brand} strokeWidth={3} />}
    </Pressable>
  );
}

/** The API's message, with field messages from a validation error (they say what to fix). */
export const errorMessage = (e: unknown): string => {
  if (e instanceof ApiRequestError) {
    const issues = e.body.error.issues?.map((i) => i.message) ?? [];
    return issues.length ? issues.join(' ') : e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
};

/** `YYYY-MM-DD` from what people type: digits only, dashes added as they go. */
export const formatDateInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');
};

export const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const styles = StyleSheet.create({
  grow: { flex: 1 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.text.muted,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionOn: { borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.brandTint },
});
