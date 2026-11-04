import type { Timeline } from "../timeline.js";

/**
 * The Galactic Disk camera and the Band's shape.
 *
 * Bodies and the Band are laid out on a flat strip ("flat" coordinates: x from the first
 * Activity at BX0 to today at BX1, y around the Band's wavy centre line), then projected in
 * one-point perspective toward a vanishing point beyond the left edge, so the past recedes and
 * today is nearest.
 */
export const BX0 = 24;
export const BX1 = 620;
const VP = [-420, 92] as const;
const NEAR = [BX1, 160] as const;
/** Scale of the far end relative to the near end: a depth ratio of 1 / 0.417 ≈ 2.4. */
export const K_FAR = 0.417;
/** Vertical exaggeration of offsets from the centre line. */
const LIFT = 1.2;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** The Band's centre line in flat coordinates. */
export const bandY = (x: number): number => 152 + 14 * Math.sin((2 * Math.PI * (x - BX0)) / 560 + 0.5);

/** Depth scale at flat x: K_FAR at the first Activity, 1 today. */
export const depthAt = (x: number): number => 1 / lerp(1 / K_FAR, 1, clamp((x - BX0) / (BX1 - BX0), 0, 1));

export interface Point {
  x: number;
  y: number;
  /** Size multiplier at this depth. */
  k: number;
}

/** Projects a flat point onto the Card. */
export function project(x: number, y: number): Point {
  const k = depthAt(x);
  return { x: VP[0] + (NEAR[0] - VP[0]) * k, y: VP[1] + (NEAR[1] - VP[1]) * k + (y - bandY(x)) * k * LIFT, k: k * 1.1 };
}

/** Flat x of a fractional period index. */
export const flatX = (t: Timeline, index: number): number => BX0 + t.pos(index) * (BX1 - BX0);

export interface Glow {
  /** Brightness 0–1 at flat x, following monthly Activity capped at the 95th-percentile month. */
  at(x: number): number;
  /** Half the Band's thickness at flat x. */
  half(x: number): number;
}

export const CAP_PERCENTILE = 0.95;

export function bandGlow(t: Timeline): Glow {
  const current = t.months.length - 1;
  const rates = t.months.filter((m) => m.commits > 0).map((m) => m.rate).sort((a, b) => a - b);
  const cap = rates.length ? rates[Math.min(rates.length - 1, Math.ceil(CAP_PERCENTILE * rates.length) - 1)]! : 1;
  const samples: { x: number; b: number }[] = [];
  t.months.forEach((m, k) => {
    const i = t.start + k;
    if (t.rifts.some((r) => i >= r.from && i < r.to)) return;
    const mid = k === current ? i + (t.end - i) / 2 : i + 0.5;
    samples.push({ x: flatX(t, mid), b: Math.min(m.rate, cap) / cap });
  });
  for (const r of t.rifts) samples.push({ x: flatX(t, (r.from + r.to) / 2), b: 0 });
  samples.sort((a, b) => a.x - b.x);
  const at = (x: number): number => {
    if (!samples.length) return 0;
    if (x <= samples[0]!.x) return samples[0]!.b;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]!;
      const b = samples[i + 1]!;
      if (x <= b.x) return lerp(a.b, b.b, smooth((x - a.x) / (b.x - a.x || 1)));
    }
    return samples[samples.length - 1]!.b;
  };
  return { at, half: (x) => 34 + 30 * at(x) };
}

/** Both ends of the Band fade in and out instead of ending in a wall. */
export const taper = (x: number): number => smooth(clamp((x - BX0) / 30, 0, 1)) * smooth(clamp((BX1 - x) / 34, 0, 1));
