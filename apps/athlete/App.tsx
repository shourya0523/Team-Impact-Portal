import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '@team-impact/ui-tokens';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Team Impact</Text>
      <Text style={styles.subtitle}>ALL IN. ALL TOGETHER.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});
