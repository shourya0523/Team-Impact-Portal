import { Pressable, Button, ScrollView, Text } from 'react-native';
import { useState } from 'react';
import { Link, router } from 'expo-router';
import type { Role } from '@team-impact/contracts';
import { useRole } from '@/navigation/role';

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
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>Who are you?</Text>
      {OPTIONS.map((option) => {
        const isSelected = selected === option.id;

        return (
          <Pressable
            key={option.id}
            onPress={() => setSelected(option.id)}
            style={{
              padding: 16,
              marginBottom: 12,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: isSelected ? '#2563eb' : '#d1d5db',
              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: 16,
                fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? '#2563eb' : '#111827',
              }}
            >
              {isSelected ? '✓  ' : ''}
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <Button title="Continue" disabled={!selected} onPress={onContinue} />
      <Link href="/onboarding/under-13" style={{ textAlign: 'center', marginTop: 12 }}>
        Under 13?
      </Link>
      <Text style={{ textAlign: 'center', marginTop: 24 }}>Sign up / sign in</Text>
    </ScrollView>
  );
}
