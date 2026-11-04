import type { Timeline } from "../timeline.js";
import { INK, mix } from "./color.js";
import { gauss, hash } from "./hash.js";
import { th, type Ink } from "./ink.js";
import { bandGlow, bandY, BX0, BX1, flatX, project, taper, type Glow } from "./scene.js";
import { H, n, poly, W } from "./svg.js";

export interface Dot {
  x: number;
  y: number;
  r: number;
  o: number;
}

/**
 * Many tiny dots as a few paths of zero-length round-capped segments, bucketed by size and
 * opacity: about 12 bytes per dot instead of about 90 for a `<circle>`.
 */
export function dotPaths(ink: Ink, dots: Dot[], color: string | { light: string; dark: string }, cls?: string): string {
  const buckets = new Map<string, string[]>();
  for (const d of dots) {
    const r = Math.max(0.3, Math.round(d.r / 0.3) * 0.3);
    const o = Math.round(d.o / 0.15) * 0.15;
    const k = `${n(r)}|${n(o, 2)}`;
    let list = buckets.get(k);
    if (!list) buckets.set(k, (list = []));
    list.push(`M${n(d.x)} ${n(d.y)}h0`);
  }
  return [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, segs]) => {
      const [r, o] = k.split("|");
      return ink.el("path", { class: cls, d: segs.join(""), fill: "none", stroke: color, "stroke-width": n(2 * Number(r)), "stroke-opacity": o, "stroke-linecap": "round" });
    })
    .join("");
}

const line = (pts: { x: number; y: number }[]) => poly(pts);

export interface Density {
  /** Star-cloud points inside the Band. */
  clouds: number;
  /** Background stars per theme. */
  background: { light: number; dark: number };
}

export const FULL_DENSITY: Density = { clouds: 380, background: { light: 45, dark: 130 } };

/** Background stars over the whole Card. Every sixth one twinkles on its own. */
export function drawBackground(ink: Ink, density: Density): string {
  const out: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    if (!ink.draws(theme)) continue;
    const light = theme === "light";
    const color = light ? "#8d939c" : "#ffffff";
    const dots: Dot[] = [];
    const twinkles: string[] = [];
    for (let i = 0; i < density.background[theme]; i++) {
      const x = hash(i, 1, 99) * W;
      const y = hash(i, 2, 99) * H;
      const r = light ? 0.5 + hash(i, 3, 99) * 0.5 : 0.3 + hash(i, 3, 99) * 0.8;
      const o = (light ? 0.35 : 0.2) + hash(i, 5, 99) * 0.45;
      if (i % 6 === 0) {
        twinkles.push(`<circle class="tw" style="animation-delay:-${n(hash(i, 4, 99) * 6)}s" cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${color}" fill-opacity="${n(o, 2)}"/>`);
      } else dots.push({ x, y, r, o });
    }
    out.push(ink.only(theme, twinkles.join("") + dotPaths(ink, dots, color)));
  }
  return out.join("");
}

/** The perspective grid: the centre line, four dashed guides, and a rung at each year boundary. */
export function drawGrid(ink: Ink, t: Timeline): string {
  const stroke = th(INK, "#9fb3d9");
  const out: string[] = [];
  for (const off of [-84, -42, 0, 42, 84]) {
    const pts = Array.from({ length: 20 }, (_, i) => {
      const x = BX0 + ((BX1 - BX0) * i) / 19;
      return project(x, bandY(x) + off);
    });
    out.push(ink.el("path", { d: line(pts), fill: "none", stroke, "stroke-opacity": th(0.16, 0.12), "stroke-width": ".7", "stroke-dasharray": off === 0 ? undefined : "2 4" }));
  }
  for (const year of yearBoundaries(t)) {
    const x = flatX(t, year * 12);
    const a = project(x, bandY(x) - 84);
    const b = project(x, bandY(x) + 84);
    out.push(ink.el("path", { d: line([a, b]), stroke, "stroke-opacity": th(0.2, 0.16), "stroke-width": ".7" }));
  }
  return out.join("");
}

/** Years whose 1 January lies after the first Activity and before today. */
export function yearBoundaries(t: Timeline): number[] {
  const years: number[] = [];
  for (let y = Math.floor(t.start / 12) + 1; y * 12 < t.end; y++) years.push(y);
  return years;
}

/** The Milky Way Band: a luminous, blurred strip whose brightness and thickness follow Activity. */
export function drawBand(ink: Ink, t: Timeline, density: Density, uid: (tag: string) => string): { svg: string; glow: Glow } {
  const glow = bandGlow(t);
  const N = 60;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const x = BX0 + ((BX1 - BX0) * i) / N;
    const tp = taper(x);
    return { x, y: bandY(x), h: glow.half(x) * (0.3 + 0.7 * tp), b: glow.at(x) * (0.25 + 0.75 * tp) };
  });
  const out: string[] = [];
  const gid = uid("bg");
  const X1 = project(BX0, 150).x;
  const X2 = project(BX1, 150).x;
  const stops = pts
    .filter((_, i) => i % 3 === 0)
    .map((p) => {
      const o = Math.min(1, Math.max(0, (project(p.x, 150).x - X1) / (X2 - X1)));
      return ink.el("stop", {
        offset: `${n(o * 100)}%`,
        "stop-color": th(mix("#d5deec", "#ecdcc0", p.b), mix("#7489c4", "#ffe6bd", p.b)),
        "stop-opacity": th(n(0.4 + 0.55 * p.b, 2), n(0.14 + 0.7 * p.b, 2)),
      });
    });
  out.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n(X1)}" x2="${n(X2)}" y1="0" y2="0">${stops.join("")}</linearGradient>`);
  const shape = (s: number) => {
    const top = pts.map((p) => project(p.x, p.y - p.h * s));
    const bot = pts.map((p) => project(p.x, p.y + p.h * s)).reverse();
    return poly([...top, ...bot], true);
  };
  const blur = (tag: string, light: number, dark: number) => {
    const ids = { light: uid(tag), dark: uid(tag) };
    for (const theme of ["light", "dark"] as const) {
      if (ink.draws(theme)) out.push(`<filter id="${ids[theme]}" x="-15%" y="-80%" width="130%" height="260%"><feGaussianBlur stdDeviation="${theme === "light" ? light : dark}"/></filter>`);
    }
    return th(`url(#${ids.light})`, `url(#${ids.dark})`);
  };
  const wide = blur("bb", 7, 12);
  const soft = blur("bs", 4, 6);
  out.push(ink.el("path", { d: shape(1.5), fill: `url(#${gid})`, "fill-opacity": th(0.6, 0.7), filter: wide }));
  out.push(ink.el("path", { d: shape(0.85), fill: `url(#${gid})`, filter: soft }));
  out.push(ink.el("path", { d: shape(0.3), fill: `url(#${gid})`, "fill-opacity": th(0.7, 1), filter: soft }));
  // dust lanes
  for (const [phase, off, op] of [[0.3, -0.12, th(0.45, 0.55)], [2.1, 0.22, th(0.3, 0.4)]] as const) {
    const lp = pts.map((p) => project(p.x, p.y + off * p.h + 6 * Math.sin(p.x / 37 + phase)));
    out.push(ink.el("path", { d: line(lp), fill: "none", stroke: th("#b9ad98", "#05070c"), "stroke-opacity": op, "stroke-width": th(2, 5), filter: soft }));
  }
  // star clouds: tiny points, denser where the Band is bright
  const dots: Record<"light" | "dark", Dot[]> = { light: [], dark: [] };
  for (let i = 0, made = 0; made < density.clouds && i < 7000; i++) {
    const x = BX0 + hash(i, 1, 21) * (BX1 - BX0);
    if (hash(i, 2, 21) > 0.12 + 0.88 * glow.at(x)) continue;
    made++;
    const q = project(x, bandY(x) + gauss(i * 13 + 5) * glow.half(x) * 0.42);
    const r = (0.25 + hash(i, 3, 21) * 0.65) * q.k;
    dots.light.push({ x: q.x, y: q.y, r, o: 0.25 + hash(i, 4, 21) * 0.5 });
    dots.dark.push({ x: q.x, y: q.y, r, o: 0.35 + hash(i, 4, 21) * 0.5 });
  }
  out.push(ink.only("light", dotPaths(ink, dots.light, INK)), ink.only("dark", dotPaths(ink, dots.dark, "#ffffff")));
  return { svg: out.join(""), glow };
}
