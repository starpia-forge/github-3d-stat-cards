import { HOVER_CLASSES } from "./planet.js";

/**
 * The Card's motion. Only opacity and pure translate are animated: nothing depends on a
 * transform origin, so nothing can fly across the Card.
 *
 * - `.gw` / `.gi`: a Star's or Starlight's outer and inner halo, out of phase; `.gs` (a Star's
 *   spikes) brightens with the inner halo. Each Body sets its own 5–11 s period inline.
 * - `.hy.a16` … `.hy.a24` / `.hx`: a Planet's two-axis hover, ±1.6–2.4 px vertically (by size; 2.4
 *   rather than 2.5 keeps both axes together within 2.6 px) and ±0.9 px horizontally, with periods
 *   set per Planet (5.5–9 s and 8–13 s).
 * - `.tw`: background and young stars twinkle over 8 s; `.neb`: Nebulae breathe over 11 s.
 */
const REST = `.tw{opacity:.7}.gw{opacity:.55}.gi,.gs{opacity:.75}.neb{opacity:.9}`;

const KEYFRAMES =
  `@keyframes tw{0%,100%{opacity:.35}50%{opacity:1}}` +
  `@keyframes gw{0%,100%{opacity:.15}50%{opacity:.9}}` +
  `@keyframes gi{0%,100%{opacity:.45}50%{opacity:1}}` +
  `@keyframes br{0%,100%{opacity:.8}50%{opacity:1}}` +
  HOVER_CLASSES.map((a) => `@keyframes hy${Math.round(a * 10)}{0%,100%{transform:translateY(-${a}px)}50%{transform:translateY(${a}px)}}`).join("") +
  `@keyframes hx{0%,100%{transform:translateX(-.9px)}50%{transform:translateX(.9px)}}`;

const RUN =
  `.tw{animation:tw 8s ease-in-out infinite}.gw{animation:gw 7s ease-in-out infinite}.gi,.gs{animation:gi 7s ease-in-out infinite}` +
  `.neb{animation:br 11s ease-in-out infinite}` +
  HOVER_CLASSES.map((a) => `.hy.a${Math.round(a * 10)}{animation:hy${Math.round(a * 10)} 7s ease-in-out infinite}`).join("") +
  `.hx{animation:hx 10s ease-in-out infinite}` +
  `@media (prefers-reduced-motion:reduce){.tw,.gw,.gi,.gs,.neb,.hy,.hx{animation:none}}`;

/** The stylesheet for motion; without animation only the resting frame remains. */
export const motionCss = (animate: boolean): string => (animate ? REST + KEYFRAMES + RUN : REST);

/** Removes per-element timing from a static Card. */
export const stripTiming = (svg: string): string => svg.replace(/ style="animation-[^"]*"/g, "");

/** Every keyframe property must be opacity or a pure translate. */
export function unsafeKeyframes(css: string): string[] {
  const bad: string[] = [];
  for (const [, body] of css.matchAll(/@keyframes\s+\w+\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)) {
    for (const [, decls] of body!.matchAll(/\{([^}]*)\}/g)) {
      for (const decl of decls!.split(";").filter(Boolean)) {
        const [prop, value = ""] = decl.split(":").map((s) => s.trim());
        if (prop === "opacity") continue;
        if (prop === "transform" && /^(translate[XY]?\([^)]*\)\s*)+$/.test(value)) continue;
        bad.push(decl);
      }
    }
  }
  return bad;
}
