import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, layout, radius, spacing, typography } from '@team-impact/ui-tokens';
import { nativeFont } from './fonts';
import { Text } from './Text';

export type InputProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Shown under the field on a warning chip. Never rely on colour alone. */
  error?: string;
};

/**
 * States: default, focused (brand ring), error, disabled. The border uses text.muted, not line:
 * line is 1.3:1 on ground and fails WCAG 1.4.11 for a control boundary.
 */
export function Input({ label, error, editable = true, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="small" weight="medium" color="secondary">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.text.muted}
        editable={editable}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.field,
          focused && styles.focused,
          !!error && styles.error,
          !editable && styles.disabled,
        ]}
      />
      {error ? (
        <View style={styles.errorChip} accessibilityLiveRegion="polite">
          <Text variant="caption" weight="medium" style={{ color: colors.warning.text }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    minHeight: layout.buttonHeight.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.text.muted,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: nativeFont[400],
    fontSize: typography.body.fontSize,
  },
  focused: {
    outlineColor: colors.brand,
    outlineWidth: 2,
    outlineOffset: 1,
    borderColor: colors.brand,
  },
  error: { borderColor: colors.warning.text },
  disabled: { backgroundColor: colors.ground, opacity: 0.6 },
  errorChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warning.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
