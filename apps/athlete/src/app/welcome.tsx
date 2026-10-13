import { router } from 'expo-router';
import { Button, Text, View } from 'react-native';

/** "/welcome": the landing page every user starts from. */
export default function Welcome() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text>Team Impact</Text>
      <Button title="Scan a team QR code" onPress={() => router.push('/scan')} />
      <Button title="Create an account" onPress={() => router.push('/sign-up')} />
      {__DEV__ && (
        <>
          <Button title="Sign in with mock data" onPress={() => router.push('/dev-sign-in')} />
          <Button title="Open card demo" onPress={() => router.push('/dev/card-demo')} />
        </>
      )}
    </View>
  );
}
