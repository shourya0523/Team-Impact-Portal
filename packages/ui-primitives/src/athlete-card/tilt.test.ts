import { describe, expect, it } from 'vitest';
import { spring, tilt } from '@team-impact/ui-tokens';
import {
  DEALT,
  FLAT_POSE,
  cssLinearEasing,
  dealStart,
  followRest,
  mix,
  springCurve,
  tiltFromAttitude,
  tiltFromPoint,
} from './tilt';
import { cardMotion } from './spec';

const W = 320;
const H = 500;
const MAX = tilt.maxDegrees;

describe('tiltFromPoint', () => {
  it('is flat with the shine centred at the centre', () => {
    expect(tiltFromPoint(W / 2, H / 2, W, H, MAX)).toEqual(FLAT_POSE);
  });

  it('reaches the token maximum (9°) at the edges, leaning toward the point', () => {
    const topLeft = tiltFromPoint(0, 0, W, H, MAX);
    expect(topLeft).toEqual({ rotateX: MAX, rotateY: -MAX, shineX: 0, shineY: 0 });
    const bottomRight = tiltFromPoint(W, H, W, H, MAX);
    expect(bottomRight).toEqual({ rotateX: -MAX, rotateY: MAX, shineX: 1, shineY: 1 });
  });

  it('never goes past the maximum, even outside the card', () => {
    for (const [x, y] of [
      [-500, -500],
      [W * 3, H * 3],
      [-1, H / 2],
      [W / 2, H + 40],
    ] as const) {
      const pose = tiltFromPoint(x, y, W, H, MAX);
      expect(Math.abs(pose.rotateX)).toBeLessThanOrEqual(MAX);
      expect(Math.abs(pose.rotateY)).toBeLessThanOrEqual(MAX);
      expect(pose.shineX).toBeGreaterThanOrEqual(0);
      expect(pose.shineX).toBeLessThanOrEqual(1);
      expect(pose.shineY).toBeGreaterThanOrEqual(0);
      expect(pose.shineY).toBeLessThanOrEqual(1);
    }
  });

  it('scales linearly in between and survives a zero-size layout', () => {
    expect(tiltFromPoint(W * 0.75, H / 2, W, H, MAX).rotateY).toBeCloseTo(MAX / 2);
    expect(tiltFromPoint(10, 10, 0, 0, MAX)).toEqual(FLAT_POSE);
  });

  it('uses the motion tokens', () => {
    expect(cardMotion.tiltMax).toBe(9);
    expect(cardMotion.spring).toEqual(spring);
  });
});

describe('springCurve', () => {
  const curve = springCurve(spring);

  it('starts at 0, ends exactly at 1 and overshoots a little (spring token)', () => {
    expect(curve.points[0]).toBe(0);
    expect(curve.points.at(-1)).toBe(1);
    const peak = Math.max(...curve.points);
    expect(peak).toBeGreaterThan(1.03);
    expect(peak).toBeLessThan(1.12);
  });

  it('settles in roughly the 350 ms the token promises', () => {
    expect(curve.durationMs).toBeGreaterThan(250);
    expect(curve.durationMs).toBeLessThan(700);
  });

  it('formats as a CSS linear() easing', () => {
    expect(cssLinearEasing(curve)).toMatch(/^linear\(0, [\d., ]+, 1\)$/);
  });

  it('does not overshoot when critically damped', () => {
    const stiff = springCurve({ stiffness: 100, damping: 20, mass: 1 });
    expect(Math.max(...stiff.points)).toBeLessThanOrEqual(1);
  });
});

describe('deal-in', () => {
  it('drops in from below, turned and small, and lands flat', () => {
    const from = dealStart(cardMotion.deal, false);
    expect(from.opacity).toBe(0);
    expect(from.translateY).toBeGreaterThan(0);
    expect(from.rotate).not.toBe(0);
    expect(from.scale).toBeLessThan(1);
    expect(mix(from.translateY, DEALT.translateY, 1)).toBe(0);
  });

  it('only fades under Reduce Motion', () => {
    expect(dealStart(cardMotion.deal, true)).toEqual({ ...DEALT, opacity: 0 });
  });

  it('uses the card-reveal duration and card-deal easing tokens', () => {
    expect(cardMotion.dealDuration).toBe(600);
    expect(cardMotion.dealEasing).toEqual([0.16, 1, 0.3, 1]);
  });
});

describe('gyro tilt', () => {
  const rest = { pitch: 40, roll: 0 };

  it('is flat at the resting angle, whatever that angle is', () => {
    expect(tiltFromAttitude(rest, rest, 20, 9)).toEqual({
      rotateX: 0,
      rotateY: 0,
      shineX: 0.5,
      shineY: 0.5,
      strength: 0,
    });
  });

  it('reaches the maximum tilt at the range, and never goes past it', () => {
    expect(tiltFromAttitude({ pitch: 40, roll: 20 }, rest, 20, 9)).toMatchObject({
      rotateY: 9,
      shineX: 0,
      strength: 1,
    });
    expect(tiltFromAttitude({ pitch: 40, roll: 75 }, rest, 20, 9).rotateY).toBe(9);
    expect(tiltFromAttitude({ pitch: 50, roll: 0 }, rest, 20, 9)).toMatchObject({
      rotateX: -4.5,
      shineY: 0.75,
      strength: 0.5,
    });
  });

  it('measures across the ±180° seam the short way round', () => {
    const pose = tiltFromAttitude({ pitch: 0, roll: -175 }, { pitch: 0, roll: 175 }, 20, 9);
    expect(pose.rotateY).toBeCloseTo(4.5);
  });

  it('re-centres on a new holding angle over time', () => {
    let r = { pitch: 0, roll: 0 };
    const held = { pitch: 30, roll: -10 };
    for (let i = 0; i < 300; i++) r = followRest(r, held, 0.02);
    expect(r.pitch).toBeCloseTo(30, 0);
    expect(r.roll).toBeCloseTo(-10, 0);
    expect(tiltFromAttitude(held, r, 20, 9).strength).toBeLessThan(0.05);
  });
});
