import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CardDemoScreen } from './src/screens/CardDemoScreen';

// TODO: move to Expo Router (src/app/) once the app has more than one screen.
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CardDemoScreen />
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
