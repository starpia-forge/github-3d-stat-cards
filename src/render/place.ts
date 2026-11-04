import { middlePeriod, type RepoActivity } from "../activity.js";
import { tierOf, type Tier } from "../tiers.js";
import type { Timeline } from "../timeline.js";
import { gauss, hash, seedOf } from "./hash.js";
import { planetShape } from "./planet.js";
import { bandY, BX0, BX1, depthAt, flatX, project } from "./scene.js";

/** Vertical exaggeration used by the camera (screen dy = flat dy × k × LIFT). */
const LIFT = 1.2;
/** Solid Bodies stay between these screen ys, clear of the header and the Tier legend. */
export const Y_MIN = 66;
export const Y_MAX = 240;
/** Breathing room between solid Bodies, px. */
const GAP = 2;

export interface Placed {
  repo: RepoActivity;
  tier: Tier;
  seed: number;
  /** Flat coordinates. */
  fx: number;
  fy: number;
  /** Screen position and depth scale. */
  x: number;
  y: number;
  k: number;
  /** Radius in flat units (scaled by k on screen). */
  r: number;
  /** Half extents of the screen bounds: the disc or core, plus rings and hover clearance for Planets. */
  halfW: number;
  halfH: number;
}

/** Larger Tiers sit nearer the Band's centre. */
const SPREAD: Record<Tier, number> = { starlight: 1.25, star: 1, planet: 0.62, nebula: 0.3 };

/** A Planet's radius grows with commits: 6 at 50, 12 at 200. */
export const planetRadius = (commits: number): number => 6 + 6 * Math.min(1, Math.max(0, Math.log(commits / 50) / Math.log(4)));

function radiusOf(tier: Tier, commits: number): number {
  if (tier === "planet") return planetRadius(commits);
  if (tier === "star") return 6;
  if (tier === "starlight") return 2.5;
  return 0;
}

export const isSolid = (b: Placed): boolean => b.tier === "planet" || b.tier === "star";

/** Places every Body. Deterministic: the same input always gives the same layout. */
export function placeBodies(repos: RepoActivity[], t: Timeline): Placed[] {
  const bodies: Placed[] = repos.map((repo) => {
    const tier = tierOf(repo.total);
    const seed = seedOf(repo.key);
    const r = radiusOf(tier, repo.total);
    const reach = tier === "planet" ? r * 2.3 : r;
    const fx = Math.min(BX1 - reach - 2, Math.max(BX0 + reach + 2, flatX(t, middlePeriod(repo))));
    const off = Math.max(-84, Math.min(84, gauss(seed) * 34 * SPREAD[tier]));
    return reproject({ repo, tier, seed, fx, fy: bandY(fx) + off, x: 0, y: 0, k: depthAt(fx), r, halfW: 0, halfH: 0 });
  });
  relax(bodies.filter(isSolid));
  return bodies;
}

function reproject(b: Placed): Placed {
  const q = project(b.fx, b.fy);
  b.x = q.x;
  b.y = q.y;
  b.k = q.k;
  if (b.tier === "planet") {
    const shape = planetShape(b.seed, b.repo.total, b.r * b.k);
    b.halfW = shape.halfW;
    b.halfH = shape.halfH;
  } else {
    b.halfW = b.halfH = b.r * b.k;
  }
  return b;
}

/** Vertical overlap of two solid Bodies' screen bounds, or 0 when they are clear. */
function overlapY(p: Placed, q: Placed): number {
  if (Math.abs(p.x - q.x) >= p.halfW + q.halfW + GAP) return 0;
  return Math.max(0, p.halfH + q.halfH + GAP - Math.abs(p.y - q.y));
}

/**
 * Pushes overlapping solid Bodies apart vertically within the canvas. Where the time position
 * leaves no room at all, some overlap remains and draw order (larger behind) resolves it.
 */
function relax(solid: Placed[]): void {
  const order = [...solid].sort((a, b) => a.repo.key.localeCompare(b.repo.key));
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let a = 0; a < order.length; a++) {
      for (let c = a + 1; c < order.length; c++) {
        const p = order[a]!;
        const q = order[c]!;
        const over = overlapY(p, q);
        if (!over) continue;
        const dy = p.y - q.y;
        const sy = dy === 0 ? (hash(p.seed, q.seed, 5) > 0.5 ? 1 : -1) : Math.sign(dy);
        const push = over / 2 + 0.2;
        p.fy += (sy * push) / (p.k * LIFT);
        q.fy -= (sy * push) / (q.k * LIFT);
        reproject(p);
        reproject(q);
        moved = true;
      }
    }
    for (const b of order) {
      if (b.y - b.halfH < Y_MIN) b.fy += (Y_MIN - (b.y - b.halfH)) / (b.k * LIFT);
      if (b.y + b.halfH > Y_MAX) b.fy -= (b.y + b.halfH - Y_MAX) / (b.k * LIFT);
      reproject(b);
    }
    if (!moved) break;
  }
}

/** Pairs of solid Bodies whose screen bounds still overlap. */
export function overlaps(bodies: Placed[]): [Placed, Placed][] {
  const solid = bodies.filter(isSolid);
  const out: [Placed, Placed][] = [];
  for (let a = 0; a < solid.length; a++)
    for (let c = a + 1; c < solid.length; c++) {
      const p = solid[a]!;
      const q = solid[c]!;
      if (Math.abs(p.x - q.x) < p.halfW + q.halfW && Math.abs(p.y - q.y) < p.halfH + q.halfH) out.push([p, q]);
    }
  return out;
}

/** Draw order: Nebulae at the back, then Starlight, then solid Bodies with larger ones behind smaller ones. */
export function drawOrder(bodies: Placed[]): Placed[] {
  const rank = { nebula: 0, starlight: 1, star: 2, planet: 2 };
  return [...bodies].sort(
    (a, b) => rank[a.tier] - rank[b.tier] || b.halfW * b.halfH - a.halfW * a.halfH || a.repo.key.localeCompare(b.repo.key),
  );
}
