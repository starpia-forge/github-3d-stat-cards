import { middlePeriod, periodIndex, type RepoActivity } from "../activity.js";
import { tierOf, type Tier } from "../tiers.js";
import type { BandTime } from "../band-time.js";
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
  /** Nebulae only: the cloud's flat width and height (scaled by k on screen). */
  w: number;
  h: number;
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
export function placeBodies(repos: RepoActivity[], t: BandTime): Placed[] {
  const bodies: Placed[] = repos.map((repo) => {
    const tier = tierOf(repo.total);
    const seed = seedOf(repo.key);
    const r = radiusOf(tier, repo.total);
    const reach = tier === "planet" ? r * 2.3 : r;
    const fx = Math.min(BX1 - reach - 2, Math.max(BX0 + reach + 2, flatX(t, middlePeriod(repo))));
    const off = Math.max(-84, Math.min(84, gauss(seed) * 34 * SPREAD[tier]));
    return reproject({ repo, tier, seed, fx, fy: bandY(fx) + off, x: 0, y: 0, k: depthAt(fx), r, halfW: 0, halfH: 0, w: 0, h: 0 });
  });
  placeNebulae(bodies.filter((b) => b.tier === "nebula"), t);
  relax(bodies.filter(isSolid));
  return bodies;
}

/** Nebula width follows the active span (with a minimum); height grows slowly with commits. */
export function nebulaSize(repo: RepoActivity, t: BandTime): { w: number; h: number; from: number; to: number } {
  const ps = Object.keys(repo.months).map(periodIndex);
  const from = flatX(t, Math.min(...ps));
  const to = flatX(t, Math.max(...ps) + 1);
  return { w: Math.min(112, Math.max(58, (to - from) * 1.1)), h: 40 + 8 * Math.log2(repo.total / 200 + 1), from, to };
}

/** Vertical slots around the centre line, nearest first. */
const SLOTS = [0, -54, 54, -27, 27, -81, 81];

/**
 * The largest Nebula sits on the centre line; each next one takes the nearest slot (above or
 * below, then shifted along the Band, then smaller) where its cloud does not collide with any
 * Nebula already placed.
 */
function placeNebulae(nebulae: Placed[], t: BandTime): void {
  const done: Placed[] = [];
  const sorted = [...nebulae].sort((a, b) => b.repo.total - a.repo.total || a.repo.key.localeCompare(b.repo.key));
  for (const b of sorted) {
    const size = nebulaSize(b.repo, t);
    const home = Math.min(BX1 - size.w / 2, Math.max(BX0 + size.w / 2, b.fx));
    let found = false;
    for (let shrink = 1; !found && shrink > 0.3; shrink *= 0.85) {
      b.w = size.w * shrink;
      b.h = size.h * shrink;
      for (const dx of [0, -0.5, 0.5, -1, 1, -1.5, 1.5]) {
        for (const dy of SLOTS) {
          b.fx = Math.min(BX1 - b.w / 2, Math.max(BX0 + b.w / 2, home + dx * b.w));
          b.fy = bandY(b.fx) + dy * shrink;
          reproject(b);
          if (!done.some((o) => collides(o, b))) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    done.push(b);
  }
}

const collides = (a: Placed, b: Placed) => Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH;

/** Pairs of Nebulae whose clouds collide. */
export function nebulaCollisions(bodies: Placed[]): [Placed, Placed][] {
  const nebs = bodies.filter((b) => b.tier === "nebula");
  const out: [Placed, Placed][] = [];
  for (let a = 0; a < nebs.length; a++) for (let c = a + 1; c < nebs.length; c++) if (collides(nebs[a]!, nebs[c]!)) out.push([nebs[a]!, nebs[c]!]);
  return out;
}

function reproject(b: Placed): Placed {
  const q = project(b.fx, b.fy);
  b.x = q.x;
  b.y = q.y;
  b.k = q.k;
  if (b.tier === "nebula") {
    // the cloud's dense part; its soft glow may overlap a neighbour's
    b.halfW = b.w * b.k * 0.45;
    b.halfH = b.h * b.k * 0.42;
  } else if (b.tier === "planet") {
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
      if (collides(p, q)) out.push([p, q]);
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
