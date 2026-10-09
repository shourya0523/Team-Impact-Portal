import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { degreesPerPixel, edgeAmount, isBackAt, settleAngle } from '../athlete-card/flip';
import { describeCard, prepareCard, useFlipState, type PreparedCard } from '../athlete-card/model';
import { useCardPalette, type CardPalette } from '../athlete-card/palette';
import { backArt, frontArt } from '../athlete-card/patterns';
import {
  CARD_WIDTH,
  cardColors as c,
  cardHeightFor,
  cardLayout as l,
  cardMotion,
  cardShadow,
  cardText,
  webFontFamily,
  type CardTextStyle,
  type CardTextVariant,
} from '../athlete-card/spec';
import type { AthleteCardData } from '../athlete-card/types';
import teamImpactLogo from '../../assets/team-impact-logo.png';
import { CardArt, PhotoBleed } from './CardArt';
import { samplePhoto } from './samplePhoto';

export interface AthleteCardProps {
  athlete: AthleteCardData;
  /** Card width in px; height follows the 5:7 aspect ratio. */
  width?: number;
  /** Controlled flip state. Omit to let the card manage it. */
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Skip photo sampling, e.g. when the palette was computed once and stored with the profile. */
  palette?: CardPalette;
  className?: string;
  style?: CSSProperties;
}

const flipEasing = `cubic-bezier(${cardMotion.easing.join(', ')})`;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** Horizontal travel before a press becomes a swipe rather than a click. */
const DRAG_SLOP = 8;

const subscribeReducedMotion = (onChange: () => void) => {
  const query = typeof window === 'undefined' ? undefined : window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION).matches);

interface Drag {
  pointerId: number;
  startX: number;
  lastX: number;
  lastTime: number;
  /** px per second, smoothed. */
  velocity: number;
  angle: number;
  active: boolean;
}

/**
 * Web twin of the native AthleteCard: same art, spec, palette and flip geometry. Drag sideways to
 * turn it (mouse or touch), or click / Enter / Space to flip. While dragging, the rotation is
 * written straight to the DOM so React doesn't re-render every frame.
 */
export const AthleteCard = ({
  athlete,
  width = CARD_WIDTH,
  flipped,
  defaultFlipped,
  onFlippedChange,
  palette: paletteOverride,
  className,
  style,
}: AthleteCardProps) => {
  const card = useMemo(() => prepareCard(athlete), [athlete]);
  const palette = useCardPalette(card.photoUri, paletteOverride, samplePhoto);
  const front = useMemo(() => frontArt(card.seed, palette), [card.seed, palette]);
  const back = useMemo(() => backArt(card.seed, palette), [card.seed, palette]);
  const s = useMemo(() => createStyles(width / CARD_WIDTH), [width]);
  const [isFlipped, setFlipped] = useFlipState(flipped, defaultFlipped, onFlippedChange);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );
  const transition = reduceMotion ? 'none' : `transform ${cardMotion.flipDuration}ms ${flipEasing}`;

  // Resting rotation. Clicks, buttons and controlled props turn it half a revolution forward;
  // swipes set it directly (and can turn it backwards).
  const [restAngle, setRestAngle] = useState(isFlipped ? 180 : 0);
  if (isBackAt(restAngle) !== isFlipped) setRestAngle(restAngle + 180);

  const flipperRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const settledBySwipe = useRef(false);

  // The mid-flip lift has no CSS-transition equivalent for click flips, so it runs on the Web
  // Animations API. Swipes already lifted the card while dragging.
  const lastRest = useRef(restAngle);
  useEffect(() => {
    if (lastRest.current === restAngle) return;
    lastRest.current = restAngle;
    if (settledBySwipe.current) {
      settledBySwipe.current = false;
      return;
    }
    if (reduceMotion) return;
    liftRef.current?.animate?.(
      [
        { transform: 'scale(1)' },
        { transform: `scale(${cardMotion.lift})` },
        { transform: 'scale(1)' },
      ],
      { duration: cardMotion.flipDuration, easing: flipEasing },
    );
  }, [restAngle, reduceMotion]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    suppressClick.current = false;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      angle: restAngle,
      active: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const flipper = flipperRef.current;
    const lift = liftRef.current;
    if (!d || d.pointerId !== event.pointerId || !flipper || !lift) return;
    const dx = event.clientX - d.startX;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      d.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      flipper.style.transition = 'none';
      lift.style.transition = 'none';
    }
    const dt = event.timeStamp - d.lastTime;
    if (dt > 0) d.velocity = 0.8 * (((event.clientX - d.lastX) / dt) * 1000) + 0.2 * d.velocity;
    d.lastX = event.clientX;
    d.lastTime = event.timeStamp;
    d.angle = restAngle + dx * degreesPerPixel(width);
    flipper.style.transform = `rotateY(${d.angle}deg)`;
    lift.style.transform = `scale(${1 + (cardMotion.lift - 1) * edgeAmount(d.angle)})`;
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    const flipper = flipperRef.current;
    const lift = liftRef.current;
    if (!d.active || !flipper || !lift) return;
    suppressClick.current = true;
    const target = settleAngle(d.angle, d.velocity * degreesPerPixel(width), restAngle);
    flipper.style.transition = transition;
    flipper.style.transform = `rotateY(${target}deg)`;
    lift.style.transition = transition;
    lift.style.transform = 'scale(1)';
    if (target !== restAngle) {
      settledBySwipe.current = true;
      setRestAngle(target);
      setFlipped(isBackAt(target));
    }
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setFlipped(!isFlipped);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setFlipped(!isFlipped);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isFlipped}
      aria-label={describeCard(card, isFlipped)}
      aria-description="Drag sideways or press to flip the card"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={className}
      style={{
        width,
        height: cardHeightFor(width),
        perspective: cardMotion.perspective,
        cursor: 'grab',
        touchAction: 'pan-y',
        borderRadius: l.radius * (width / CARD_WIDTH),
        fontFamily: webFontFamily,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...style,
      }}
    >
      <div ref={liftRef} style={{ width: '100%', height: '100%' }}>
        <div
          ref={flipperRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${restAngle}deg)`,
            transition,
          }}
        >
          <div style={s.face} aria-hidden={isFlipped} data-face="front">
            <CardArt art={front} />
            <FrontFace card={card} palette={palette} s={s} />
          </div>
          <div
            style={{ ...s.face, transform: 'rotateY(180deg)' }}
            aria-hidden={!isFlipped}
            data-face="back"
          >
            <CardArt art={back} />
            <BackFace card={card} palette={palette} s={s} />
          </div>
        </div>
      </div>
    </div>
  );
};

type Styles = ReturnType<typeof createStyles>;
interface FaceProps {
  card: PreparedCard;
  palette: CardPalette;
  s: Styles;
}

const FrontFace = ({ card, palette, s }: FaceProps) => (
  <>
    <PhotoBleed uri={card.photoUri} palette={palette} />
    <div style={s.photoWindow}>
      {!card.photoUri && (
        <div style={s.placeholder}>
          <span style={s.initials}>{card.initials}</span>
        </div>
      )}
      <div style={s.photoTop}>
        <img src={teamImpactLogo} alt="Team Impact" draggable={false} style={s.logo} />
        {card.jerseyNumber && (
          <div style={s.jerseyBadge}>
            <span style={s.badgeNumber}>{card.jerseyNumber}</span>
          </div>
        )}
      </div>
      <div style={s.nameplate}>
        <div style={{ ...s.firstName, ...s.onDark, ...s.ellipsis }}>{card.firstName}</div>
        <div style={{ ...s.lastName, ...s.onDark, ...s.ellipsis }}>{card.lastName}</div>
      </div>
    </div>

    {card.positionBadge && (
      <div style={{ ...s.positionBadge, borderColor: palette.deep }}>
        <span style={s.badgeText}>{card.positionBadge}</span>
      </div>
    )}

    <div style={s.lower}>
      <div style={{ ...s.eyebrow, ...s.teamLine, ...s.ellipsis }}>{card.teamLine}</div>

      {card.stats.length > 0 && (
        <div style={s.stats}>
          {card.stats.map((stat, i) => (
            <div key={stat.label} style={{ ...s.stat, ...(i > 0 ? s.statDivider : null) }}>
              <div style={{ ...s.statValue, ...s.onDark, ...s.ellipsis }}>{stat.value}</div>
              <div style={{ ...s.statLabel, ...s.onDarkMuted, ...s.ellipsis }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.section}>
        <div style={{ ...s.eyebrow, color: c.yellow }}>Experience</div>
        {card.experience.map((entry) => (
          <div key={`${entry.role}-${entry.organization}`} style={s.entry}>
            <div style={s.entryBar} />
            <div style={{ ...s.entryTitle, ...s.onDark, ...s.flex, ...s.ellipsis }}>
              {entry.role}
              <span style={{ ...s.entryMeta, ...s.onDarkMuted }}> · {entry.organization}</span>
            </div>
            <div style={{ ...s.entryMeta, ...s.onDarkFaint, whiteSpace: 'nowrap' }}>
              {entry.period}
            </div>
          </div>
        ))}
      </div>

      <div style={s.skills}>
        {card.skills.map((skill) => (
          <span key={skill} style={{ ...s.chip, ...s.chipOnDark }}>
            {skill}
          </span>
        ))}
      </div>
    </div>
  </>
);

const BackFace = ({ card, palette, s }: FaceProps) => (
  <div style={s.content}>
    <div style={s.backHeader}>
      {card.photoUri ? (
        <img
          src={card.photoUri}
          alt=""
          draggable={false}
          style={{ ...s.avatar, objectFit: 'cover' }}
        />
      ) : (
        <div style={{ ...s.avatar, ...s.avatarPlaceholder, backgroundColor: palette.glow }}>
          <span style={{ ...s.badgeNumber, ...s.onDark }}>{card.initials}</span>
        </div>
      )}
      <div style={s.flex}>
        <div style={{ ...s.eyebrow, color: c.yellow }}>Off the field</div>
        <div style={{ ...s.name, ...s.onDark, ...s.ellipsis }}>{card.fullName}</div>
        {card.personalLine.length > 0 && (
          <div style={{ ...s.subtle, ...s.onDarkMuted, ...s.ellipsis }}>{card.personalLine}</div>
        )}
      </div>
    </div>

    {card.bio && (
      <div style={s.section}>
        <div style={{ ...s.eyebrow, color: palette.band }}>About</div>
        <div style={{ ...s.body, color: c.ink, ...clamp(3) }}>{card.bio}</div>
      </div>
    )}

    {card.facts.length > 0 && (
      <div style={s.facts}>
        {card.facts.map((fact) => (
          <div key={fact.label} style={s.fact}>
            <div style={{ ...s.statLabel, color: c.inkMuted, ...s.ellipsis }}>{fact.label}</div>
            <div style={{ ...s.factValue, color: c.ink, ...s.ellipsis }}>{fact.value}</div>
          </div>
        ))}
      </div>
    )}

    <div style={s.chips}>
      {card.interests.map((interest) => (
        <span
          key={interest}
          style={{ ...s.chip, ...s.chipOnLight, color: palette.band, borderColor: palette.band }}
        >
          {interest}
        </span>
      ))}
    </div>

    {card.contact.length > 0 && (
      <div style={{ ...s.contact, backgroundColor: palette.band }}>
        {card.contact.map((line) => (
          <div key={line.label} style={s.contactLine}>
            <span style={{ ...s.statLabel, ...s.contactLabel, color: c.yellow }}>{line.label}</span>
            <span style={{ ...s.entryMeta, ...s.onDark, ...s.flex, ...s.ellipsis }}>
              {line.value}
            </span>
          </div>
        ))}
      </div>
    )}

    <div style={{ ...s.footer, color: c.inkMuted }}>Swipe or tap to flip ↻</div>
  </div>
);

const clamp = (lines: number): CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

const text = (variant: CardTextVariant, scale: number): CSSProperties => {
  const spec: CardTextStyle = cardText[variant];
  return {
    margin: 0,
    fontSize: spec.fontSize * scale,
    lineHeight: `${spec.lineHeight * scale}px`,
    fontWeight: Number(spec.fontWeight),
    letterSpacing: (spec.letterSpacing ?? 0) * scale,
    textTransform: spec.uppercase ? 'uppercase' : 'none',
  };
};

// Mirrors createStyles in ../native/AthleteCard.tsx; keep the two in step.
const createStyles = (k: number) => {
  const column: CSSProperties = { display: 'flex', flexDirection: 'column' };
  const row: CSSProperties = { display: 'flex', flexDirection: 'row' };
  const center: CSSProperties = { ...row, alignItems: 'center', justifyContent: 'center' };
  const photoBottom = (l.photoInset + l.photoHeight) * k;
  return {
    face: {
      ...column,
      position: 'absolute',
      inset: 0,
      borderRadius: l.radius * k,
      overflow: 'hidden',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      boxShadow: cardShadow,
    },
    content: {
      ...column,
      position: 'relative',
      flex: 1,
      boxSizing: 'border-box',
      padding: l.padding * k,
      gap: l.gap * k,
      justifyContent: 'space-between',
    },
    flex: { flex: 1, minWidth: 0 },
    ellipsis: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    onDark: { color: c.white },
    onDarkMuted: { color: 'rgba(255,255,255,0.75)' },
    onDarkFaint: { color: 'rgba(255,255,255,0.55)' },
    eyebrow: text('eyebrow', k),

    photoWindow: {
      position: 'absolute',
      left: l.photoInset * k,
      right: l.photoInset * k,
      top: l.photoInset * k,
      height: l.photoHeight * k,
    },
    placeholder: { ...center, position: 'absolute', inset: 0 },
    initials: { ...text('initials', k), color: 'rgba(255,255,255,0.92)' },
    photoTop: {
      ...row,
      position: 'absolute',
      left: 10 * k,
      right: 10 * k,
      top: 10 * k,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    logo: {
      display: 'block',
      height: l.logoHeight * k,
      width: l.logoHeight * l.logoAspect * k,
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
    },
    jerseyBadge: {
      ...center,
      width: l.jerseyBadge * k,
      height: l.jerseyBadge * k,
      borderRadius: '50%',
      backgroundColor: c.yellow,
    },
    badgeNumber: { ...text('badgeNumber', k), color: c.navyDeep },
    nameplate: {
      ...column,
      position: 'absolute',
      left: 14 * k,
      right: (l.positionBadge + 22) * k,
      bottom: 12 * k,
    },
    firstName: text('firstName', k),
    lastName: text('lastName', k),
    positionBadge: {
      ...center,
      position: 'absolute',
      right: (l.photoInset + 14) * k,
      top: photoBottom - (l.positionBadge / 2) * k,
      width: l.positionBadge * k,
      height: l.positionBadge * k,
      boxSizing: 'border-box',
      borderRadius: '50%',
      borderWidth: l.photoBorder * k,
      borderStyle: 'solid',
      backgroundColor: c.yellow,
    },
    badgeText: { ...text('badge', k), color: c.navyDeep },

    lower: {
      ...column,
      position: 'absolute',
      left: l.lowerPaddingX * k,
      right: l.lowerPaddingX * k,
      top: photoBottom + l.lowerPaddingY * k,
      bottom: (l.lowerPaddingY + 2) * k,
      justifyContent: 'space-between',
    },
    teamLine: { color: c.yellow, paddingRight: (l.positionBadge + 4) * k },
    subtle: text('subtle', k),
    stats: {
      ...row,
      backgroundColor: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: l.tileRadius * k,
      padding: `${7 * k}px 0`,
    },
    stat: { ...column, flex: 1, minWidth: 0, alignItems: 'center' },
    statDivider: { borderLeft: '1px solid rgba(255,255,255,0.14)' },
    statValue: text('statValue', k),
    statLabel: text('statLabel', k),

    section: { ...column, gap: 4 * k },
    entry: { ...row, gap: 8 * k, alignItems: 'center', minWidth: 0 },
    entryBar: {
      width: 3 * k,
      height: 12 * k,
      flexShrink: 0,
      borderRadius: 2 * k,
      backgroundColor: c.yellow,
    },
    entryTitle: text('entryTitle', k),
    entryMeta: text('entryMeta', k),

    // One row of whole chips: extras wrap onto a clipped second row rather than squashing.
    skills: {
      ...row,
      flexWrap: 'wrap',
      gap: 6 * k,
      height: (cardText.chip.lineHeight + l.chipPaddingY * 2) * k + 2,
      overflow: 'hidden',
    },
    chips: { ...row, flexWrap: 'wrap', gap: 6 * k },
    chip: {
      ...text('chip', k),
      padding: `${l.chipPaddingY * k}px ${l.chipPaddingX * k}px`,
      borderRadius: l.chipRadius,
      borderWidth: 1,
      borderStyle: 'solid',
      whiteSpace: 'nowrap',
    },
    chipOnDark: { color: c.white, borderColor: 'rgba(255,255,255,0.32)' },
    chipOnLight: { backgroundColor: 'rgba(255,255,255,0.6)' },
    footer: { ...text('footer', k), textAlign: 'center' },

    backHeader: {
      ...row,
      alignItems: 'center',
      gap: 12 * k,
      paddingRight: 8 * k,
      height: l.backHeader * k,
      flexShrink: 0,
    },
    avatar: {
      width: l.avatar * k,
      height: l.avatar * k,
      flexShrink: 0,
      boxSizing: 'border-box',
      borderRadius: '50%',
      border: `${l.photoBorder * k}px solid ${c.white}`,
    },
    avatarPlaceholder: center,
    name: text('name', k),
    body: text('body', k),
    facts: { ...row, flexWrap: 'wrap', gap: 6 * k },
    fact: {
      ...column,
      boxSizing: 'border-box',
      width: '48.5%',
      flexGrow: 1,
      minWidth: 0,
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderRadius: l.tileRadius * k,
      padding: `${7 * k}px ${10 * k}px`,
      gap: 2 * k,
    },
    factValue: text('factValue', k),
    contact: {
      ...column,
      borderRadius: l.tileRadius * k,
      padding: `${8 * k}px ${12 * k}px`,
      gap: 3 * k,
    },
    contactLine: { ...row, alignItems: 'center', gap: 10 * k, minWidth: 0 },
    contactLabel: { width: l.contactLabel * k, flexShrink: 0 },
  } satisfies Record<string, CSSProperties>;
};
