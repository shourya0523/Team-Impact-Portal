import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import type { Role } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { useRole } from '@/navigation/role';
import { Button, Icon, Text } from '@/ui';

const OPTIONS: { id: Role; label: string }[] = [
  { id: 'athlete', label: 'Athlete' },
  { id: 'parent', label: 'Parent' },
  { id: 'teen', label: 'Teammate, 13–17' },
  { id: 'coach', label: 'Coach' },
  { id: 'alumni_athlete', label: 'Alumni (former athlete)' },
  { id: 'alumni_mentor', label: 'Alumni (mentor)' },
  { id: 'recruiter', label: 'Recruiter' },
];
/** "/sign-up": sign up / sign in as each user type. Placeholder for now. */
export default function SignUp() {
  const [selected, setSelected] = useState<Role | null>(null);
  const { setRole } = useRole();

  // Save the role, then continue to that role's details step (onboarding/details.tsx).
  const onContinue = () => {
    if (!selected) return;
    setRole(selected);
    router.push('/onboarding/details');
  };

  return (
    // ScrollView: with 7 roles the list can be taller than a small screen. flexGrow keeps it
    // centred when it fits.
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="display" size="md" color="brand" style={styles.center}>
        Who are you?
      </Text>
      {OPTIONS.map((option) => {
        const isSelected = selected === option.id;

        return (
          <Pressable
            key={option.id}
            onPress={() => setSelected(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            style={[styles.option, isSelected && styles.optionOn]}
          >
            {isSelected && <Icon name="check" size={18} color={colors.brand} strokeWidth={3} />}
            <Text weight={isSelected ? 'semibold' : 'regular'} color={isSelected ? 'brand' : 'ink'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <Button label="Continue" size="lg" disabled={!selected} onPress={onContinue} />
      <Link href="/onboarding/under-13" style={styles.link}>
        <Text weight="semibold" color="brand">
          Under 13?
        </Text>
      </Link>
      <Text variant="small" color="secondary" style={styles.center}>
        Sign up / sign in
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.ground },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  center: { textAlign: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  link: { alignSelf: 'center', marginTop: spacing.sm },
});
