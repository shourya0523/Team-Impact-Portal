import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { codeFromScan } from '@/components/join';
import { Button, Text } from '@/ui';
const FRAME_BORDER = 3;

export function QrScanner({
  paused,
  onScan,
  onTypeInstead,
}: {
  /** True while the screen shows a result; the camera stops reading codes. */
  paused: boolean;
  /** The code from the QR, or null when it isn't a Team IMPACT code. */
  onScan: (code: string | null) => void;
  onTypeInstead: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  useEffect(() => {
    if (!paused) handled.current = false;
  }, [paused]);

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    handled.current = true;
    onScan(codeFromScan(data));
  };
  if (!permission) return <ActivityIndicator color={colors.brand} />;
  if (!permission.granted) {
    const canOpenSettings = !permission.canAskAgain && Platform.OS !== 'web';
    return (
      <View style={styles.ask}>
        <Text color="secondary">
          {permission.canAskAgain
            ? 'To scan, Team IMPACT needs your camera. It’s only on while this screen is open.'
            : 'Camera access is off for Team IMPACT. Turn it on in Settings, or type the code.'}
        </Text>
        {permission.canAskAgain && (
          <Button label="Allow camera" onPress={() => requestPermission()} />
        )}
        {canOpenSettings && <Button label="Open settings" onPress={() => Linking.openSettings()} />}
        <Button label="Type the code instead" variant="secondary" onPress={onTypeInstead} />
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.viewfinder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={paused ? undefined : onBarcodeScanned}
        />
        <View style={styles.frame} pointerEvents="none" />
      </View>
      <Text color="secondary" style={styles.center}>
        Point at the code your coach shared
      </Text>
      <Button label="Type the code instead" variant="secondary" onPress={onTypeInstead} />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  ask: { gap: spacing.sm },
  viewfinder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  frame: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    borderWidth: FRAME_BORDER,
    borderColor: colors.surface,
    borderRadius: radius.xl,
  },
  center: { textAlign: 'center' },
});
