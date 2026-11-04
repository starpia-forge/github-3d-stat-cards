import { middlePeriod, type RepoActivity } from "../activity.js";
import { tierOf, type Tier } from "../tiers.js";
import type { Timeline } from "../timeline.js";
import { gauss, hash, seedOf } from "./hash.js";
import { bandY, BX0, BX1, depthAt, flatX, project } from "./scene.js";

/** Vertical exaggeration used by the camera (screen dy = flat dy × k × LIFT). */
const LIFT = 1.2;
/** Solid Bodies stay between these screen ys, clear of the header and the Tier legend. */
export const Y_MIN = 66;
export const Y_MAX = 240;

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
  /** Extra clearance around the Body on screen (rings, hover). */
  clearance: number;
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

/** Screen-space extent used for overlap checks. */
const extent = (b: Placed) => b.r * b.k + b.clearance;

/** Places every Body. Deterministic: the same input always gives the same layout. */
export function placeBodies(repos: RepoActivity[], t: Timeline, clearanceOf: (b: Placed) => number = () => 0): Placed[] {
  const bodies: Placed[] = repos.map((repo) => {
    const tier = tierOf(repo.total);
    const seed = seedOf(repo.key);
    const r = radiusOf(tier, repo.total);
    const fx = Math.min(BX1 - r - 2, Math.max(BX0 + r + 2, flatX(t, middlePeriod(repo))));
    const off = Math.max(-84, Math.min(84, gauss(seed) * 34 * SPREAD[tier]));
    const b: Placed = { repo, tier, seed, fx, fy: bandY(fx) + off, x: 0, y: 0, k: depthAt(fx), r, clearance: 0 };
    b.clearance = clearanceOf(b);
    return reproject(b);
  });
  relax(bodies.filter((b) => b.tier === "planet" || b.tier === "star"));
  return bodies;
}

function reproject(b: Placed): Placed {
  const q = project(b.fx, b.fy);
  b.x = q.x;
  b.y = q.y;
  b.k = q.k;
  return b;
}

/** Pushes overlapping solid Bodies apart vertically, measured on projected screen bounds. */
function relax(solid: Placed[]): void {
  const order = [...solid].sort((a, b) => a.repo.key.localeCompare(b.repo.key));
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let a = 0; a < order.length; a++) {
      for (let c = a + 1; c < order.length; c++) {
        const p = order[a]!;
        const q = order[c]!;
        const need = extent(p) + extent(q) + 3;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d = Math.hypot(dx, dy);
        if (d >= need) continue;
        // move along y only, by enough that the horizontal gap plus the new vertical gap clears
        const wantDy = Math.sqrt(Math.max(0, need * need - dx * dx));
        const push = (wantDy - Math.abs(dy)) / 2 + 0.2;
        const sy = dy === 0 ? (hash(p.seed, q.seed, 5) > 0.5 ? 1 : -1) : Math.sign(dy);
        p.fy += (sy * push) / (p.k * LIFT);
        q.fy -= (sy * push) / (q.k * LIFT);
        reproject(p);
        reproject(q);
        moved = true;
      }
    }
    for (const b of order) {
      const lo = Y_MIN + extent(b);
      const hi = Y_MAX - extent(b);
      if (b.y < lo) b.fy += (lo - b.y) / (b.k * LIFT);
      if (b.y > hi) b.fy -= (b.y - hi) / (b.k * LIFT);
      reproject(b);
    }
    if (!moved) break;
  }
}

/** Pairs of solid Bodies whose screen bounds still overlap (for tests). */
export function overlaps(bodies: Placed[]): [Placed, Placed][] {
  const solid = bodies.filter((b) => b.tier === "planet" || b.tier === "star");
  const out: [Placed, Placed][] = [];
  for (let a = 0; a < solid.length; a++)
    for (let c = a + 1; c < solid.length; c++) {
      const p = solid[a]!;
      const q = solid[c]!;
      if (Math.hypot(p.x - q.x, p.y - q.y) < extent(p) + extent(q)) out.push([p, q]);
    }
  return out;
}
