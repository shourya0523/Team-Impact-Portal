import { useEffect, useState, type ChangeEvent } from 'react';
import { AthleteCard, cardColors, sampleAthlete } from '@team-impact/ui-primitives/web';
import { colors, fontSize, spacing } from '@team-impact/ui-tokens';

const buttonStyle = {
  minHeight: 44,
  padding: `0 ${spacing.md}px`,
  borderRadius: 999,
  border: 'none',
  fontSize: fontSize.sm,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
} as const;

/** Portal preview of the same athlete card the app renders, with a local photo upload. */
export const AthleteCardPreview = () => {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => () => void (photoUri && URL.revokeObjectURL(photoUri)), [photoUri]);

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setPhotoUri(URL.createObjectURL(file));
  };

  return (
    <section
      aria-labelledby="athlete-card-heading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.lg,
        padding: spacing.xl,
        borderRadius: 24,
        background: cardColors.offWhite,
      }}
    >
      <h2
        id="athlete-card-heading"
        style={{ margin: 0, fontSize: fontSize.lg, color: cardColors.navy }}
      >
        Athlete card
      </h2>
      <AthleteCard
        athlete={{ ...sampleAthlete, photoUri }}
        width={340}
        flipped={flipped}
        onFlippedChange={setFlipped}
      />
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
        <label style={{ ...buttonStyle, background: cardColors.yellow, color: colors.text }}>
          {photoUri ? 'Change photo' : 'Upload photo'}
          <input type="file" accept="image/*" onChange={onPhoto} hidden />
        </label>
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          style={{ ...buttonStyle, background: cardColors.navy, color: colors.primaryContrast }}
        >
          {flipped ? 'Show resume' : 'Show personal'}
        </button>
      </div>
    </section>
  );
};
