import type { Languages } from "../languages.js";
import { INK, mix } from "./color.js";
import { hash } from "./hash.js";
import type { Ink } from "./ink.js";
import { colorOf } from "./palette.js";
import type { Placed } from "./place.js";
import { n } from "./svg.js";

export interface DrawContext {
  ink: Ink;
  langs: Languages;
  uid: (tag: string) => string;
  /** A definition shared by every Body that needs the same one (bounding-box units make gradients reusable). */
  shared: (key: string, make: (id: string) => string) => string;
}

/**
 * Glow timing for one Body: a slow period of its own (5–11 s), with the outer halo a little
 * behind the inner one, so the light seems to swell outward and settle back.
 */
export function glowTiming(seed: number): { inner: string; outer: string; duration: number } {
  const dur = 5 + hash(seed, 7, 3) * 6;
  const del = hash(seed, 8, 3) * dur;
  return {
    inner: `animation-duration:${n(dur)}s;animation-delay:-${n(del)}s`,
    outer: `animation-duration:${n(dur)}s;animation-delay:-${n(del - dur * 0.14)}s`,
    duration: dur,
  };
}

/** The light-mode halo colour: the Language's pastel, or a pale ink wash for an uncoloured repository. */
const lightWash = (langs: Languages, key: string | null): string => (key === null ? mix(INK, "#ffffff", 0.75) : colorOf(langs, key, "light"));

/** Starlight (1–9 commits): a point with a soft halo in its Primary Language colour. */
export function drawStarlight(b: Placed, ctx: DrawContext): string {
  const { ink, langs } = ctx;
  const key = langs.primaryOf(b.repo);
  const t = glowTiming(b.seed);
  const cx = n(b.x);
  const cy = n(b.y);
  // light: two pastel washes breathe out of phase around an ink dot
  const wash = lightWash(langs, key);
  const light = ink.only(
    "light",
    `<circle class="gw" style="${t.outer}" cx="${cx}" cy="${cy}" r="${n(4.6 * b.k)}" fill="${wash}" fill-opacity=".55"/>` +
      `<circle class="gi" style="${t.inner}" cx="${cx}" cy="${cy}" r="${n(2.6 * b.k)}" fill="${wash}"/><circle cx="${cx}" cy="${cy}" r="1.15" fill="${INK}"/>`,
  );
  let dark = "";
  if (ink.draws("dark")) {
    const c = colorOf(langs, key, "dark");
    const g = ctx.shared(`sl${c}`, (id) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    dark = ink.only(
      "dark",
      `<circle class="gw" style="${t.outer}" cx="${cx}" cy="${cy}" r="${n(6.5 * b.k)}" fill="url(#${g})"/>` +
        `<circle class="gi" style="${t.inner}" cx="${cx}" cy="${cy}" r="${n(3.2 * b.k)}" fill="url(#${g})"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${n(1.1 * b.k)}" fill="${mix(c, "#ffffff", 0.7)}"/>`,
    );
  }
  return light + dark;
}

/** Star (10–49 commits): a halo plus four light spikes in its Primary Language colour. */
export function drawStar(b: Placed, ctx: DrawContext): string {
  const { ink, langs } = ctx;
  const key = langs.primaryOf(b.repo);
  const t = glowTiming(b.seed);
  const { x, y, k } = b;
  let light = "";
  if (ink.draws("light")) {
    const c = lightWash(langs, key);
    const L = 7 * k;
    light = ink.only(
      "light",
      `<circle class="gw" style="${t.outer}" cx="${n(x)}" cy="${n(y)}" r="${n(9 * k)}" fill="${c}" fill-opacity=".5"/>` +
        `<circle class="gi" style="${t.inner}" cx="${n(x)}" cy="${n(y)}" r="${n(5.5 * k)}" fill="${c}"/>` +
        `<path class="gs" style="${t.inner}" d="M${n(x - L)} ${n(y)}H${n(x + L)}M${n(x)} ${n(y - L)}V${n(y + L)}" stroke="${INK}" stroke-width=".7"/>` +
        `<circle cx="${n(x)}" cy="${n(y)}" r="${n(2.7 * k)}" fill="${c}" stroke="${INK}" stroke-width=".7"/>`,
    );
  }
  let dark = "";
  if (ink.draws("dark")) {
    const c = colorOf(langs, key, "dark");
    const g = ctx.shared(`st${c}`, (id) => `<radialGradient id="${id}"><stop offset="0" stop-color="${mix(c, "#ffffff", 0.5)}" stop-opacity=".95"/><stop offset=".35" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    const s = ctx.shared(`sp${c}`, (id) => `<linearGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`);
    const L = 13 * k;
    const spike = (rot: string) => `<rect x="${n(x - L)}" y="${n(y - 0.45 * k)}" width="${n(2 * L)}" height="${n(0.9 * k)}" fill="url(#${s})"${rot}/>`;
    // two halo layers breathe out of phase; the light spikes brighten with the inner one
    dark = ink.only(
      "dark",
      `<circle class="gw" style="${t.outer}" cx="${n(x)}" cy="${n(y)}" r="${n(15 * k)}" fill="url(#${g})"/>` +
        `<circle class="gi" style="${t.inner}" cx="${n(x)}" cy="${n(y)}" r="${n(7.5 * k)}" fill="url(#${g})"/>` +
        `<g class="gs" style="${t.inner}">${spike("")}${spike(` transform="rotate(90 ${n(x)} ${n(y)})"`)}</g>` +
        `<circle cx="${n(x)}" cy="${n(y)}" r="${n(1.8 * k)}" fill="${mix(c, "#ffffff", 0.75)}"/>`,
    );
  }
  return light + dark;
}
