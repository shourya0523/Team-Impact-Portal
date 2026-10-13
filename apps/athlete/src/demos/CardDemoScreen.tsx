import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { AthleteCard, sampleAthlete } from '@team-impact/ui-primitives/native';
import { colors, spacing } from '@team-impact/ui-tokens';
import { Button, Text } from '@/ui';

/** Widest the card gets on tablets and web. */
const MAX_CARD_WIDTH = 360;

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text variant="eyebrow" color="action">
        Team IMPACT
      </Text>
      <Text variant="display" size="md" color="brand" style={styles.title}>
        Your athlete card
      </Text>
      <Text variant="small" color="secondary" style={styles.subtitle}>
        Swipe or tap the card to flip between your resume and your story.
      </Text>

      <AthleteCard
        athlete={{ ...sampleAthlete, photoUri }}
        width={Math.min(width - spacing.xl * 2, MAX_CARD_WIDTH)}
        flipped={flipped}
        onFlippedChange={setFlipped}
        style={styles.card}
      />

      <View style={styles.actions}>
        <Button label={photoUri ? 'Change photo' : 'Upload photo'} size="sm" onPress={pickPhoto} />
        <Button
          label={flipped ? 'Show resume' : 'Show personal'}
          variant="brand"
          size="sm"
          onPress={() => setFlipped((value) => !value)}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.ground },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  title: { marginTop: spacing.xs },
  subtitle: { textAlign: 'center', marginTop: spacing.xs },
  card: { marginVertical: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
