import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { hasBaseballCard, type CardFace } from '@team-impact/contracts';
import {
  AthleteCardFace,
  CARD_HEIGHT,
  CARD_WIDTH,
  type AthleteCardData,
  type CardSide,
} from '@team-impact/ui-primitives/native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { exportCardData, fileNameFor } from '@/components/cardExport';
import { cardPng, download } from '@/components/cardPng';
import { shareCardFace } from '@/components/cardShare';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Card, Icon, Text } from '@/ui';

const MAX_PREVIEW = 320;
const SIDES: readonly CardSide[] = ['front', 'back'];
const SIDE_LABEL: Record<CardSide, string> = { front: 'Front', back: 'Back' };

/**
 * "/card/export": both faces of the published card as PNGs (PRD A8, TI-114). Only athletes and
 * alumni athletes have a card; anyone else gets a note and no export, and the API refuses them
 * too. The API hands out the published face without contact details, so children and teens are
 * never exported. Images come from the flat card face, so tilt and shine never bake in: native
 * snapshots `AthleteCardFace` and opens the share sheet; the web draws the face on a canvas.
 */
export default function ExportCard() {
  const { role } = useRole();
  return (
    <Screen eyebrow="Baseball Card" title="Export as image" back>
      {role && hasBaseballCard(role) ? (
        <ExportSides />
      ) : (
        <Gutter>
          <Card style={styles.note}>
            <Icon name="card" size={20} color={colors.brand} />
            <Text variant="small" color="secondary" style={styles.grow}>
              Only athletes and alumni athletes have a Baseball Card to export.
            </Text>
          </Card>
        </Gutter>
      )}
    </Screen>
  );
}

function ExportSides() {
  const { width } = useWindowDimensions();
  const { state } = useApi(() => api.cardExport());
  const previewW = Math.min(width - spacing.md * 2, MAX_PREVIEW);
  return (
    <Async state={state}>
      {({ face, fileName }) => (
        <Gutter>
          <Text color="secondary">
            Both sides of your published card, without your contact details.{' '}
            {Platform.OS === 'web' ? 'Download them' : 'Share them'} anywhere.
          </Text>
          {Platform.OS === 'web' ? (
            SIDES.map((side) => (
              <WebSide key={side} face={face} side={side} fileName={fileName} width={previewW} />
            ))
          ) : (
            <NativeSides face={face} fileName={fileName} width={previewW} />
          )}
        </Gutter>
      )}
    </Async>
  );
}

interface SideProps {
  side: CardSide;
  fileName: string;
  width: number;
}

function NativeSides({
  face,
  fileName,
  width,
}: {
  face: CardFace;
  fileName: string;
  width: number;
}) {
  const data = useMemo(() => exportCardData(face), [face]);
  return SIDES.map((side) => (
    <NativeSide key={side} data={data} side={side} fileName={fileName} width={width} />
  ));
}

/** The flat face is the preview and what gets captured, so what you see is what you share. */
function NativeSide({ data, side, fileName, width }: SideProps & { data: AthleteCardData }) {
  const face = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const share = () => {
    setBusy(true);
    setError(null);
    shareCardFace(face, fileNameFor(fileName, side))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Couldn’t share your card. Try again.'),
      )
      .finally(() => setBusy(false));
  };
  return (
    <View style={styles.side}>
      <SectionLabel>{SIDE_LABEL[side]}</SectionLabel>
      <View style={styles.center}>
        <AthleteCardFace ref={face} athlete={data} side={side} width={width} />
      </View>
      {error && <ErrorText>{error}</ErrorText>}
      <Button label={`Share the ${side} as PNG`} icon="card" disabled={busy} onPress={share} />
    </View>
  );
}

function WebSide({ face, side, fileName, width }: SideProps & { face: CardFace }) {
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    cardPng(face, side).then(
      (url) => live && setPng(url),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [face, side]);

  return (
    <View style={styles.side}>
      <SectionLabel>{SIDE_LABEL[side]}</SectionLabel>
      <View style={styles.center}>
        {png ? (
          <Image
            source={{ uri: png }}
            accessibilityLabel={`The ${side} of your Baseball Card as an image`}
            style={[styles.preview, { width, height: (width * CARD_HEIGHT) / CARD_WIDTH }]}
          />
        ) : (
          !error && <Text color="secondary">Drawing your card…</Text>
        )}
      </View>
      {error && <ErrorText>{error}</ErrorText>}
      <Button
        label={`Download the ${side} as PNG`}
        icon="card"
        disabled={!png}
        onPress={() => png && download(png, fileNameFor(fileName, side))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  side: { gap: spacing.sm },
  center: { alignItems: 'center' },
  preview: { borderRadius: radius.card },
});
