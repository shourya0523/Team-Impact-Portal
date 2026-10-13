import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Screen, text } from '@/components/ui';

/** "/onboarding/pending": waiting on the coach. */
export default function Pending() {
  const { teamName } = useLocalSearchParams<{ teamName?: string }>();
  return (
    <Screen title="Request sent">
      <Card>
        <Text style={text.strong}>{teamName ?? 'Your team'}</Text>
        <Text style={text.body}>
          A coach will look at your request. We’ll let you know as soon as they approve it.
        </Text>
      </Card>
      <Button
        label="Scan a team QR code instead"
        kind="secondary"
        onPress={() => router.push('/scan')}
      />
    </Screen>
  );
}
