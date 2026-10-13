import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { AthleteCard, cardColors, sampleAthlete } from '@team-impact/ui-primitives/native';
import { colors, fontSize, spacing } from '@team-impact/ui-tokens';

/** Demo of the flippable athlete card with a photo picked from the device library. */
export const CardDemoScreen = () => {
  const { width } = useWindowDimensions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const pickPhoto = async () => {
    // Launching the library needs no permission prompt; the system picker is scoped to one photo.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    // The card samples the photo's colours itself, so the gradient updates automatically.
    if (asset) setPhotoUri(asset.uri);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>TEAM IMPACT</Text>
      <Text style={styles.title}>Your athlete card</Text>
      <Text style={styles.subtitle}>
        Swipe or tap the card to flip between your resume and your story.
      </Text>

      <AthleteCard
        athlete={{ ...sampleAthlete, photoUri }}
        width={Math.min(width - spacing.xl * 2, 360)}
        flipped={flipped}
        onFlippedChange={setFlipped}
        style={styles.card}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={pickPhoto}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {photoUri ? 'Change photo' : 'Upload photo'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFlipped((value) => !value)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryContrast }]}>
            {flipped ? 'Show resume' : 'Show personal'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    backgroundColor: cardColors.offWhite,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: cardColors.red },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: cardColors.navy,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: { marginVertical: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: cardColors.yellow },
  secondary: { backgroundColor: cardColors.navy },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: fontSize.sm, fontWeight: '700' },
});
