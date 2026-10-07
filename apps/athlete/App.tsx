import { StatusBar } from 'expo-status-bar';
import { TokenSample } from './src/screens/TokenSample';
import { useAppFonts } from './src/ui';

export default function App() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;
  return (
    <>
      <TokenSample />
      <StatusBar style="dark" />
    </>
  );
}
