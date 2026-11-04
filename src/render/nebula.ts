import { INK, mix, pastel } from "./color.js";
import type { DrawContext } from "./bodies.js";
import { gauss, hash } from "./hash.js";
import { th } from "./ink.js";
import { colorOf } from "./palette.js";
import type { Placed } from "./place.js";
import { n } from "./svg.js";
import type { TextWriter } from "./text.js";

/**
 * A Nebula (200+ commits): a gas cloud coloured by its Language Mix and stretched along the Band.
 * Dark: wisps per Language share, warped by turbulence and blurred, a soft glow, a bright core
 * and young stars. Light: pastel wisps, stippling and the star atlas's dotted outline.
 */
export function drawNebula(b: Placed, ctx: DrawContext): string {
  const { ink, langs, uid } = ctx;
  const { x, y, k } = b;
  const w = b.w * k;
  const h = b.h * k;
  const mixList = langs.mixOf(b.repo).filter((m) => m.share > 0.02);
  const cols = mixList.length ? mixList : [{ key: langs.primaryOf(b.repo), share: 1 }];
  const blobs: { key: string | null; share: number; cx: number; cy: number; rx: number; ry: number; ang: number }[] = [];
  cols.forEach((m, q) => {
    const count = Math.max(2, Math.round(m.share * 14));
    for (let j = 0; j < count; j++) {
      blobs.push({
        key: m.key,
        share: m.share,
        cx: x + gauss(b.seed + q * 31 + j * 7) * 0.26 * w,
        cy: y + gauss(b.seed + q * 37 + j * 11) * 0.24 * h,
        rx: w * (0.12 + 0.16 * hash(b.seed, q * 10 + j, 4)),
        ry: h * (0.07 + 0.1 * hash(b.seed, q * 10 + j, 6)),
        ang: -14 + gauss(b.seed + q * 41 + j * 3) * 22,
      });
    }
  });
  const main = cols[0]!.key;
  const parts: string[] = [];
  const fid = { light: uid("nf"), dark: uid("nf") };
  for (const theme of ["light", "dark"] as const) {
    if (!ink.draws(theme)) continue;
    parts.push(
      `<filter id="${fid[theme]}" x="-100%" y="-120%" width="300%" height="340%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="${Math.abs(b.seed) % 97}" result="n"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="n" scale="${n(26 * k)}"/><feGaussianBlur stdDeviation="${theme === "light" ? 3.5 : 4.5}"/></filter>`,
    );
  }
  const glowIds = { light: uid("ng"), dark: uid("ng") };
  for (const theme of ["light", "dark"] as const) {
    if (!ink.draws(theme)) continue;
    const c = colorOf(langs, main, theme);
    parts.push(`<radialGradient id="${glowIds[theme]}"><stop offset="0" stop-color="${c}" stop-opacity="${theme === "light" ? 0.55 : 0.4}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
  }
  parts.push(ink.el("ellipse", { cx: n(x), cy: n(y), rx: n(w * 0.62), ry: n(h * 0.66), fill: th(`url(#${glowIds.light})`, `url(#${glowIds.dark})`) }));
  const wisps = blobs.map((bl) =>
    ink.el("ellipse", {
      cx: n(bl.cx),
      cy: n(bl.cy),
      rx: n(bl.rx),
      ry: n(bl.ry),
      fill: th(mix(colorOf(langs, bl.key, "light"), pastel(colorOf(langs, bl.key, "light")), 0.3), colorOf(langs, bl.key, "dark")),
      "fill-opacity": th(0.6, n(0.5 + 0.3 * bl.share, 2)),
      transform: `rotate(${n(bl.ang)} ${n(bl.cx)} ${n(bl.cy)})`,
    }),
  );
  parts.push(ink.el("g", { class: "neb", filter: th(`url(#${fid.light})`, `url(#${fid.dark})`) }, wisps.join("")));

  // a bright core (dark) or the atlas's dotted outline and stippling (light)
  if (ink.draws("dark")) {
    const cg = uid("ncg");
    parts.push(
      ink.only(
        "dark",
        `<radialGradient id="${cg}"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".4" stop-color="${mix(colorOf(langs, main, "dark"), "#ffffff", 0.6)}" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
          `<ellipse cx="${n(x + w * 0.05)}" cy="${n(y - h * 0.04)}" rx="${n(w * 0.16)}" ry="${n(h * 0.2)}" fill="url(#${cg})"/>`,
      ),
    );
  }
  if (ink.draws("light")) {
    const stipple: string[] = [];
    for (let j = 0; j < 14; j++) stipple.push(`M${n(x + gauss(b.seed + 500 + j) * w * 0.22)} ${n(y + gauss(b.seed + 550 + j) * h * 0.2)}h0`);
    parts.push(
      ink.only(
        "light",
        `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w * 0.52)}" ry="${n(h * 0.58)}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width=".8" stroke-dasharray="1.2 3" transform="rotate(-8 ${n(x)} ${n(y)})"/>` +
          `<path d="${stipple.join("")}" stroke="${INK}" stroke-opacity=".45" stroke-width="1.1" stroke-linecap="round"/>`,
      ),
    );
  }
  // young stars; the two brightest carry light spikes in dark mode
  for (let j = 0; j < 12; j++) {
    const sx = x + gauss(b.seed + 900 + j) * w * 0.22;
    const sy = y + gauss(b.seed + 950 + j) * h * 0.2;
    const big = j < 2;
    const R = (big ? 1.6 : 0.5 + hash(b.seed, j, 8) * 0.8) * k;
    parts.push(ink.el("circle", { class: "tw", style: `animation-delay:-${n(hash(b.seed, j, 9) * 5)}s`, cx: n(sx), cy: n(sy), r: n(R), fill: th(INK, "#fff"), "fill-opacity": th(0.65, 0.95) }));
    if (big) parts.push(ink.el("path", { d: `M${n(sx - 6 * k)} ${n(sy)}H${n(sx + 6 * k)}M${n(sx)} ${n(sy - 6 * k)}V${n(sy + 6 * k)}`, stroke: "#fff", "stroke-opacity": ".55", "stroke-width": ".6" }, undefined, "dark"));
  }
  return parts.join("");
}

/** The name under a public Nebula. Private repositories never get a label. */
export function nebulaLabel(b: Placed, tw: TextWriter, login: string): string {
  if (b.repo.isPrivate || !b.repo.name) return "";
  const [owner, repo] = b.repo.name.split("/");
  const name = owner?.toLowerCase() === login.toLowerCase() && repo ? repo : b.repo.name;
  return tw.draw(b.x, b.y + b.h * b.k * 0.62 + 10, name, { face: "sans", size: 10, fill: th(INK, "#dfe6ee"), opacity: 0.85, anchor: "middle", maxWidth: Math.max(80, b.w * b.k * 1.3) });
}
