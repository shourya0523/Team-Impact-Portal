/**
 * Flip geometry shared by both renderers. The card's rotation is an unbounded angle in degrees:
 * multiples of 180 are resting positions, odd multiples show the back. Swiping right turns the
 * card one way, left the other, and it never "unwinds".
 *
 * The 'worklet' directives let Reanimated run these on the UI thread; elsewhere they're inert.
 */

/** Dragging one full card width turns the card half a revolution. */
export const degreesPerPixel = (cardWidth: number) => 180 / cardWidth;

/** How far (in seconds of travel) a release velocity carries the card when choosing a side. */
const FLING_PROJECTION = 0.12;

export const isBackAt = (angle: number) => {
  'worklet';
  return Math.abs(Math.round(angle / 180)) % 2 === 1;
};

/** True while the front face points at the viewer. */
export const isFrontVisible = (angle: number) => {
  'worklet';
  const n = ((angle % 360) + 360) % 360;
  return n < 90 || n > 270;
};

/** 0 at rest, 1 when the card is edge-on: drives the mid-flip lift. */
export const edgeAmount = (angle: number) => {
  'worklet';
  return Math.abs(Math.sin((angle * Math.PI) / 180));
};

/**
 * Where a released swipe settles: the nearest resting angle after projecting the fling, but never
 * more than one flip away from where the swipe started.
 */
export const settleAngle = (angle: number, velocity: number, restAngle: number) => {
  'worklet';
  const target = Math.round((angle + velocity * FLING_PROJECTION) / 180) * 180;
  return Math.min(restAngle + 180, Math.max(restAngle - 180, target));
};
