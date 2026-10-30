import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { easing } from '@team-impact/ui-tokens';
import { degreesPerPixel, edgeAmount, isBackAt, settleAngle } from '../athlete-card/flip';
import { describeCard, prepareCard, useFlipState, type PreparedCard } from '../athlete-card/model';
import { useCardPalette, type CardPalette } from '../athlete-card/palette';
import { backArt, frontArt } from '../athlete-card/patterns';
import {
  CARD_WIDTH,
  NAME_LINE_HEIGHT,
  cardColors as c,
  cardHeightFor,
  cardLayout as l,
  cardMotion,
  cardShadow,
  cardShine,
  cardText,
  displayFont,
  holoStops,
  webFontFamily,
  withAlpha,
  type CardTextStyle,
  type CardTextVariant,
} from '../athlete-card/spec';
import {
  FLAT_POSE,
  cssLinearEasing,
  dealStart,
  springCurve,
  tiltFromPoint,
  type TiltPose,
} from '../athlete-card/tilt';
import type { AthleteCardData } from '../athlete-card/types';
import teamImpactLogo from '../../assets/team-impact-logo.png';
import { CardArt, PhotoBleed } from './CardArt';
import { samplePhoto } from './samplePhoto';

export type CardSide = 'front' | 'back';

export interface AthleteCardProps {
  athlete: AthleteCardData;
  /** Card width in px; height follows CARD_HEIGHT / CARD_WIDTH. */
  width?: number;
  /** Controlled flip state. Omit to let the card manage it. */
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Skip photo sampling, e.g. when the palette was computed once and stored with the profile. */
  palette?: CardPalette;
  /** Tilt (up to `tilt.maxDegrees`) and holo shine under the pointer. Default on; off under Reduce Motion. */
  tilt?: boolean;
  /** Deal the card in on mount (card-reveal motion; a fade under Reduce Motion). Default on. */
  dealIn?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface AthleteCardFaceProps {
  athlete: AthleteCardData;
  side?: CardSide;
  width?: number;
  palette?: CardPalette;
  className?: string;
  style?: CSSProperties;
}

const bezier = (b: readonly number[]) => `cubic-bezier(${b.join(', ')})`;
const flipEasing = bezier(cardMotion.easing);
const dealEasing = bezier(cardMotion.dealEasing);
const SPRING = springCurve(cardMotion.spring);
/** CSS `linear()` reproduces the spring token; older browsers get the spring-ish bezier instead. */
const springEasing =
  typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)')
    ? cssLinearEasing(SPRING)
    : bezier(easing.spring);
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
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

const tiltTransform = (pose: TiltPose) =>
  `perspective(${cardMotion.perspective}px) rotateX(${pose.rotateX}deg) rotateY(${pose.rotateY}deg)`;
const percent = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;
/** CSS custom properties the shine layers read; written straight to the DOM while tilting. */
const shineVars = {
  x: '--ti-card-shine-x',
  y: '--ti-card-shine-y',
  opacity: '--ti-card-shine-o',
} as const;

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

/** Shared by the interactive card and the flat face: display data, colours, art and styles. */
const useCardModel = (athlete: AthleteCardData, width: number, paletteOverride?: CardPalette) => {
  const card = useMemo(() => prepareCard(athlete), [athlete]);
  const palette = useCardPalette(card.photoUri, paletteOverride, samplePhoto);
  const front = useMemo(() => frontArt(card.seed, palette), [card.seed, palette]);
  const back = useMemo(() => backArt(card.seed, palette), [card.seed, palette]);
  const s = useMemo(() => createStyles(width / CARD_WIDTH), [width]);
  return { card, palette, front, back, s };
};

/**
 * Web twin of the native AthleteCard: same art, spec, palette and flip geometry. Drag sideways to
 * turn it (mouse or touch), or click / Enter / Space to flip. It deals in on mount, and tilts with
 * a holo shine under the pointer, springing back to flat when the pointer leaves. While dragging
 * or tilting, transforms are written straight to the DOM so React doesn't re-render every frame.
 */
export const AthleteCard = ({
  athlete,
  width = CARD_WIDTH,
  flipped,
  defaultFlipped,
  onFlippedChange,
  palette: paletteOverride,
  tilt = true,
  dealIn = true,
  className,
  style,
}: AthleteCardProps) => {
  const { card, palette, front, back, s } = useCardModel(athlete, width, paletteOverride);
  const [isFlipped, setFlipped] = useFlipState(flipped, defaultFlipped, onFlippedChange);
  const reduceMotion = useReducedMotion();
  const tiltOn = tilt && !reduceMotion;
  const transition = reduceMotion ? 'none' : `transform ${cardMotion.flipDuration}ms ${flipEasing}`;

  // Resting rotation. Clicks, buttons and controlled props turn it half a revolution forward;
  // swipes set it directly (and can turn it backwards).
  const [restAngle, setRestAngle] = useState(isFlipped ? 180 : 0);
  if (isBackAt(restAngle) !== isFlipped) setRestAngle(restAngle + 180);

  const dealRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const settledBySwipe = useRef(false);

  // Card reveal, once, before the first paint so the card never flashes in place first.
  const dealt = useRef(false);
  useLayoutEffect(() => {
    if (dealt.current) return;
    dealt.current = true;
    if (!dealIn) return;
    const from = dealStart(cardMotion.deal, reduceMotion);
    const k = width / CARD_WIDTH;
    dealRef.current?.animate?.(
      [
        {
          opacity: from.opacity,
          transform: `translateY(${from.translateY * k}px) rotate(${from.rotate}deg) scale(${from.scale})`,
        },
        { opacity: 1, transform: 'none' },
      ],
      { duration: cardMotion.dealDuration, easing: dealEasing, fill: 'backwards' },
    );
  }, [dealIn, reduceMotion, width]);

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

  /** Follow the pointer (`settle` false) or spring back to flat and fade the shine (`settle`). */
  const setPose = (pose: TiltPose, settle: boolean) => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transition = settle
      ? `transform ${SPRING.durationMs}ms ${springEasing}`
      : `transform ${cardMotion.followDuration}ms linear`;
    el.style.transform = tiltTransform(pose);
    if (!settle) {
      el.style.setProperty(shineVars.x, percent(pose.shineX));
      el.style.setProperty(shineVars.y, percent(pose.shineY));
    }
    el.style.setProperty(shineVars.opacity, settle ? '0' : String(cardShine.opacity));
  };
  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    const pose = tiltFromPoint(
      event.clientX - r.left,
      event.clientY - r.top,
      r.width,
      r.height,
      cardMotion.tiltMax,
    );
    setPose(pose, false);
  };
  const release = () => {
    if (tiltOn) setPose(FLAT_POSE, true);
  };

  // Reduce Motion switched on mid-tilt: drop straight back to flat, with no shine.
  useEffect(() => {
    if (tiltOn) return;
    const el = tiltRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = tiltTransform(FLAT_POSE);
    el.style.setProperty(shineVars.opacity, '0');
  }, [tiltOn]);

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
    if (tiltOn) follow(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) {
      // Hovering with a mouse or pen: tilt toward it.
      if (!d && tiltOn) follow(event);
      return;
    }
    const flipper = flipperRef.current;
    const lift = liftRef.current;
    if (!flipper || !lift) return;
    const dx = event.clientX - d.startX;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_SLOP) {
        if (tiltOn) follow(event);
        return;
      }
      // A swipe: the card turns instead, so let go of the tilt first.
      d.active = true;
      release();
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
    // A mouse keeps hovering after a click, so it keeps the tilt; touch and pen let go.
    if (event.pointerType !== 'mouse' || event.type === 'pointercancel') release();
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

  const onPointerLeave = () => {
    if (!drag.current?.active) release();
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

  const radius = l.radius * (width / CARD_WIDTH);
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
      onPointerLeave={onPointerLeave}
      className={className}
      style={{
        width,
        height: cardHeightFor(width),
        cursor: 'grab',
        touchAction: 'pan-y',
        borderRadius: radius,
        fontFamily: webFontFamily,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...style,
      }}
    >
      <div ref={dealRef} style={s.fill}>
        <div
          ref={tiltRef}
          style={{
            ...s.fill,
            transformStyle: 'preserve-3d',
            transform: tiltTransform(FLAT_POSE),
            ...({
              [shineVars.x]: '50%',
              [shineVars.y]: '50%',
              [shineVars.opacity]: '0',
            } as CSSProperties),
          }}
        >
          <div ref={liftRef} style={{ ...s.fill, transformStyle: 'preserve-3d' }}>
            <div
              ref={flipperRef}
              style={{
                ...s.fill,
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: `rotateY(${restAngle}deg)`,
                transition,
              }}
            >
              <div style={s.face} aria-hidden={isFlipped} data-face="front">
                <CardArt art={front} />
                <FrontFace card={card} palette={palette} s={s} />
                {tiltOn && <Shine side="front" radius={radius} />}
              </div>
              <div
                style={{ ...s.face, transform: 'rotateY(180deg)' }}
                aria-hidden={!isFlipped}
                data-face="back"
              >
                <CardArt art={back} />
                <BackFace card={card} palette={palette} s={s} hint="Swipe or tap to flip ↻" />
                {tiltOn && <Shine side="back" radius={radius} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * One side of the card, flat and still: no flip, tilt, shine, deal-in or shadow. For image
 * export and print, so motion effects never bake into the picture.
 */
export const AthleteCardFace = ({
  athlete,
  side = 'front',
  width = CARD_WIDTH,
  palette: paletteOverride,
  className,
  style,
}: AthleteCardFaceProps) => {
  const { card, palette, front, back, s } = useCardModel(athlete, width, paletteOverride);
  const isBack = side === 'back';
  return (
    <div
      role="img"
      aria-label={describeCard(card, isBack)}
      data-face={side}
      className={className}
      style={{
        ...s.flatFace,
        width,
        height: cardHeightFor(width),
        fontFamily: webFontFamily,
        ...style,
      }}
    >
      <CardArt art={isBack ? back : front} />
      {isBack ? (
        <BackFace card={card} palette={palette} s={s} hint={card.seasonLine} />
      ) : (
        <FrontFace card={card} palette={palette} s={s} />
      )}
    </div>
  );
};

/**
 * Holo shine: a white hotspot plus an iridescent band, both centred on the pointer. The back face
 * is mirrored (it's turned 180°), so its hotspot uses the mirrored x.
 */
const Shine = ({ side, radius }: { side: CardSide; radius: number }) => {
  const x = side === 'front' ? `var(${shineVars.x}, 50%)` : `calc(100% - var(${shineVars.x}, 50%))`;
  const y = `var(${shineVars.y}, 50%)`;
  const span = `${cardShine.holoSpan * 100}%`;
  const highlight = withAlpha(cardShine.highlight.color, cardShine.highlight.opacity);
  const holo = holoStops()
    .map((stop) => `${withAlpha(stop.color, stop.opacity)} ${(stop.offset * 100).toFixed(1)}%`)
    .join(', ');
  return (
    <div
      aria-hidden
      data-shine={side}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity: `var(${shineVars.opacity}, 0)`,
        transition: `opacity ${cardMotion.shineFade}ms linear`,
        backgroundImage: [
          `radial-gradient(circle at ${x} ${y}, ${highlight} 0%, transparent ${cardShine.highlightRadius * 100}%)`,
          `linear-gradient(${cardShine.holoAngle}deg, transparent ${cardShine.holoStart * 100}%, ${holo}, transparent ${cardShine.holoEnd * 100}%)`,
        ].join(', '),
        backgroundSize: `100% 100%, ${span} ${span}`,
        backgroundPosition: `0 0, ${x} ${y}`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

type Styles = ReturnType<typeof createStyles>;
interface FaceProps {
  card: PreparedCard;
  palette: CardPalette;
  s: Styles;
}

/** Team colour stripe across the top edge (decorative). */
const Stripe = ({ card, s }: { card: PreparedCard; s: Styles }) => (
  <div aria-hidden style={{ ...s.stripe, backgroundColor: card.teamColor }} />
);

/**
 * Rookie-card front from the Signing Day mockups: team stripe, jersey number over the photo,
 * name, position and team, then class, major and division.
 */
const FrontFace = ({ card, palette, s }: FaceProps) => {
  const k = s.k;
  const fit = card.nameFit;
  return (
    <>
      <PhotoBleed uri={card.photoUri} palette={palette} />
      <div style={s.photoWindow}>
        {!card.photoUri && (
          <div style={s.placeholder}>
            <span style={s.initials}>{card.initials}</span>
          </div>
        )}
        {card.jerseyDigits && (
          <div aria-hidden style={s.jersey}>
            {card.jerseyDigits}
          </div>
        )}
        <img src={teamImpactLogo} alt="Team Impact" draggable={false} style={s.logo} />
      </div>

      <div style={s.lower}>
        <div style={s.rookieTop}>
          <div
            style={{
              ...s.rookieName,
              fontSize: fit.fontSize * k,
              lineHeight: `${fit.fontSize * NAME_LINE_HEIGHT * k}px`,
            }}
          >
            {fit.lines.map((line, i) => (
              <div key={i} style={s.ellipsis}>
                {line}
              </div>
            ))}
          </div>
          {card.rookieLine && (
            <div style={{ ...s.rookieLine, ...s.ellipsis }}>{card.rookieLine}</div>
          )}
        </div>

        {card.rookieStats.length > 0 && (
          <div style={s.rookieRow}>
            {card.rookieStats.map((stat) => (
              <div key={stat.label} style={s.rookieCell}>
                <div style={{ ...s.statLabel, color: c.yellow, ...s.ellipsis }}>{stat.label}</div>
                <div style={{ ...s.rookieValue, ...s.onDark, ...s.ellipsis }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Stripe card={card} s={s} />
    </>
  );
};

/** Back: who they are, experience rows, skills, about, facts and (when shared) contact. */
const BackFace = ({ card, palette, s, hint }: FaceProps & { hint: string | null }) => {
  const chips = [...card.skills, ...card.interests];
  return (
    <>
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
              <div style={{ ...s.subtle, ...s.onDarkMuted, ...s.ellipsis }}>
                {card.personalLine}
              </div>
            )}
          </div>
        </div>

        {card.experience.length > 0 && (
          <div style={s.section}>
            <div style={{ ...s.eyebrow, color: palette.band }}>Experience</div>
            {card.experience.map((entry, i) => (
              <div key={`${i}-${entry.role}`} style={s.entry}>
                <div style={{ ...s.entryBar, backgroundColor: palette.band }} />
                <div style={{ ...s.entryTitle, color: c.ink, ...s.flex, ...s.ellipsis }}>
                  {entry.role}
                  {entry.organization && (
                    <span style={{ ...s.entryMeta, color: c.inkMuted }}>
                      {' '}
                      · {entry.organization}
                    </span>
                  )}
                </div>
                {entry.period && (
                  <div style={{ ...s.entryMeta, color: c.inkMuted, whiteSpace: 'nowrap' }}>
                    {entry.period}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {chips.length > 0 && (
          <div style={s.chipRow}>
            {chips.map((chip, i) => (
              <span
                key={`${i}-${chip}`}
                style={{
                  ...s.chip,
                  ...s.chipOnLight,
                  color: palette.band,
                  borderColor: palette.band,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {card.bio && (
          <div style={s.section}>
            <div style={{ ...s.eyebrow, color: palette.band }}>About</div>
            <div style={{ ...s.body, color: c.ink, ...clamp(2) }}>{card.bio}</div>
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

        {card.contact.length > 0 && (
          <div style={{ ...s.contact, backgroundColor: palette.band }}>
            {card.contact.map((line) => (
              <div key={line.label} style={s.contactLine}>
                <span style={{ ...s.statLabel, ...s.contactLabel, color: c.yellow }}>
                  {line.label}
                </span>
                <span style={{ ...s.entryMeta, ...s.onDark, ...s.flex, ...s.ellipsis }}>
                  {line.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={s.spacer} />
        {hint && <div style={{ ...s.footer, color: c.inkMuted }}>{hint}</div>}
      </div>
      <Stripe card={card} s={s} />
    </>
  );
};

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
    ...(spec.display ? { fontFamily: displayFont.web } : null),
  };
};

const textShadow = `0 2px 8px ${withAlpha(c.ink, 0.45)}`;

// Mirrors createStyles in ../native/AthleteCard.tsx; keep the two in step.
const createStyles = (k: number) => {
  const column: CSSProperties = { display: 'flex', flexDirection: 'column' };
  const row: CSSProperties = { display: 'flex', flexDirection: 'row' };
  const center: CSSProperties = { ...row, alignItems: 'center', justifyContent: 'center' };
  const photoBottom = (l.photoInset + l.photoHeight) * k;
  const styles = {
    fill: { width: '100%', height: '100%' },
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
    flatFace: {
      ...column,
      position: 'relative',
      borderRadius: l.radius * k,
      overflow: 'hidden',
    },
    content: {
      ...column,
      position: 'relative',
      flex: 1,
      boxSizing: 'border-box',
      padding: l.padding * k,
      gap: l.gap * k,
    },
    spacer: { flex: 1, marginTop: -l.gap * k },
    flex: { flex: 1, minWidth: 0 },
    ellipsis: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    onDark: { color: c.white },
    onDarkMuted: { color: withAlpha(c.white, 0.75) },
    eyebrow: text('eyebrow', k),
    stripe: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: l.stripe * k,
      pointerEvents: 'none',
    },

    photoWindow: {
      position: 'absolute',
      left: l.photoInset * k,
      right: l.photoInset * k,
      top: l.photoInset * k,
      height: l.photoHeight * k,
    },
    placeholder: { ...center, position: 'absolute', inset: 0 },
    initials: { ...text('initials', k), color: withAlpha(c.white, 0.92) },
    jersey: {
      ...text('jersey', k),
      position: 'absolute',
      left: l.jerseyInsetX * k,
      top: l.jerseyInsetY * k,
      color: c.white,
      textShadow,
    },
    logo: {
      position: 'absolute',
      right: 10 * k,
      top: 10 * k,
      display: 'block',
      height: l.logoHeight * k,
      width: l.logoHeight * l.logoAspect * k,
      filter: `drop-shadow(0 2px 4px ${withAlpha(c.ink, 0.35)})`,
    },
    badgeNumber: { ...text('badgeNumber', k), color: c.navyDeep },

    lower: {
      ...column,
      position: 'absolute',
      left: l.lowerPaddingX * k,
      right: l.lowerPaddingX * k,
      top: photoBottom + l.lowerPaddingY * k,
      bottom: (l.lowerPaddingY + 4) * k,
      justifyContent: 'space-between',
    },
    rookieTop: { ...column, gap: l.rookieGap * k, minWidth: 0 },
    rookieName: { ...text('rookieName', k), color: c.white, textShadow },
    rookieLine: { ...text('rookieLine', k), color: c.white },
    rookieRow: {
      ...row,
      gap: 10 * k,
      paddingTop: l.rookieRowPadding * k,
      borderTop: `1px solid ${withAlpha(c.white, 0.18)}`,
    },
    rookieCell: { ...column, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 * k },
    rookieValue: text('rookieValue', k),
    subtle: text('subtle', k),
    statLabel: text('statLabel', k),

    section: { ...column, gap: 4 * k },
    entry: { ...row, gap: 8 * k, alignItems: 'center', minWidth: 0 },
    entryBar: { width: 3 * k, height: 12 * k, flexShrink: 0, borderRadius: 2 * k },
    entryTitle: text('entryTitle', k),
    entryMeta: text('entryMeta', k),

    // One row of whole chips: extras wrap onto a clipped second row rather than squashing.
    chipRow: {
      ...row,
      flexWrap: 'wrap',
      gap: 6 * k,
      flexShrink: 0,
      height: (cardText.chip.lineHeight + l.chipPaddingY * 2) * k + 2,
      overflow: 'hidden',
    },
    chip: {
      ...text('chip', k),
      padding: `${l.chipPaddingY * k}px ${l.chipPaddingX * k}px`,
      borderRadius: l.chipRadius,
      borderWidth: 1,
      borderStyle: 'solid',
      whiteSpace: 'nowrap',
    },
    chipOnLight: { backgroundColor: withAlpha(c.white, 0.6) },
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
    facts: { ...row, gap: 6 * k, flexShrink: 0 },
    fact: {
      ...column,
      boxSizing: 'border-box',
      flex: 1,
      minWidth: 0,
      backgroundColor: withAlpha(c.white, 0.72),
      borderRadius: l.tileRadius * k,
      padding: `${7 * k}px ${10 * k}px`,
      gap: 2 * k,
    },
    factValue: text('factValue', k),
    contact: {
      ...column,
      flexShrink: 0,
      borderRadius: l.tileRadius * k,
      padding: `${8 * k}px ${12 * k}px`,
      gap: 3 * k,
    },
    contactLine: { ...row, alignItems: 'center', gap: 10 * k, minWidth: 0 },
    contactLabel: { width: l.contactLabel * k, flexShrink: 0 },
  } satisfies Record<string, CSSProperties>;
  return { ...styles, k };
};
