import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teamImpactLogo } from '@team-impact/ui-primitives/native';
import { Button } from '@/components/ui';
import { c, font } from '@/theme';

/** "/welcome": the landing page every user starts from. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: c.navy }}
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 24,
        gap: 24,
      }}
    >
      <Image
        source={teamImpactLogo}
        style={styles.logo}
        accessibilityLabel="Team IMPACT"
        resizeMode="contain"
      />
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Text style={styles.title} accessibilityRole="header">
          YOUR TEAM.{'\n'}
          <Text style={{ color: '#ff8a9b' }}>YOUR PEOPLE.</Text>
        </Text>
        <Text style={styles.body}>
          The Team IMPACT app keeps teams, families and coaches together, and gives every athlete a
          Baseball Card.
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        <Button label="Create an account" size="lg" onPress={() => router.push('/sign-up')} />
        <Button
          label="Scan a team QR code"
          kind="onNavy"
          icon="qr"
          size="lg"
          onPress={() => router.push('/scan')}
        />
        {__DEV__ && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button
              label="Mock sign-in"
              kind="white"
              size="sm"
              stretch
              onPress={() => router.push('/dev-sign-in')}
            />
            <Button
              label="Card demo"
              kind="onNavy"
              size="sm"
              stretch
              onPress={() => router.push('/dev/card-demo')}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  logo: { width: 84, height: 84, borderRadius: 18, backgroundColor: '#fff' },
  title: { fontFamily: font.display, fontSize: 64, lineHeight: 60, color: '#fff' },
  body: { fontFamily: font.body, fontSize: 17, lineHeight: 25, color: c.navyTint },
});
