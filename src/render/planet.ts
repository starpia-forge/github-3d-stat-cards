import { adjust, INK, mix, type Theme } from "./color.js";
import type { DrawContext } from "./bodies.js";
import { hash } from "./hash.js";
import { th } from "./ink.js";
import { colorOf } from "./palette.js";
import type { Placed } from "./place.js";
import { n, poly } from "./svg.js";

/** Rings appear at this many commits; a storm spot at STORM_AT. */
export const RINGS_AT = 120;
export const STORM_AT = 100;
/**
 * Hover amplitude in px: vertical grows with the Planet's size from 1.6 to 2.4 in steps of 0.2
 * (2.4 rather than 2.5 keeps both axes together within 2.6 px), horizontal is 0.9.
 */
export const HOVER = { y: { min: 1.6, max: 2.4, step: 0.2 }, x: 0.9 };

/** The vertical hover amplitude for a Planet of screen radius `r` (3 px or less: 1.6; 12 px or more: 2.4). */
export function hoverAmplitude(r: number): number {
  const t = Math.min(1, Math.max(0, (r - 3) / 9));
  const steps = Math.round((t * (HOVER.y.max - HOVER.y.min)) / HOVER.y.step);
  return Math.round((HOVER.y.min + steps * HOVER.y.step) * 10) / 10;
}

/** The hover classes, one per amplitude: `a16` … `a24`. */
export const HOVER_CLASSES = Array.from({ length: Math.round((HOVER.y.max - HOVER.y.min) / HOVER.y.step) + 1 }, (_, i) => Math.round((HOVER.y.min + i * HOVER.y.step) * 10) / 10);

export interface PlanetShape {
  /** Disc radius on screen. */
  r: number;
  /** Disc tilt in degrees. */
  tilt: number;
  ring?: { inner: number; outer: number; squash: number; tilt: number };
  /** Half extents of the screen bounding box including rings and hover. */
  halfW: number;
  halfH: number;
}

/** A Planet's shape on screen; shared by placement (bounds) and drawing. */
export function planetShape(seed: number, commits: number, r: number): PlanetShape {
  const tilt = (hash(seed, 3, 7) - 0.5) * 36;
  const hoverY = hoverAmplitude(r);
  let halfW = r;
  let halfH = r;
  let ring: PlanetShape["ring"];
  if (commits >= RINGS_AT) {
    ring = { inner: r * 1.38, outer: r * 2.3, squash: 0.3, tilt: tilt * 0.6 - 8 };
    const a = (ring.tilt * Math.PI) / 180;
    const rx = ring.outer;
    const ry = ring.outer * ring.squash;
    halfW = Math.max(halfW, Math.hypot(rx * Math.cos(a), ry * Math.sin(a)));
    halfH = Math.max(halfH, Math.hypot(rx * Math.sin(a), ry * Math.cos(a)));
  }
  return { r, tilt, ring, halfW: halfW + HOVER.x, halfH: halfH + hoverY };
}

/**
 * A gas giant banded by its Language Mix: latitude bands projected on a sphere (curving with the
 * view, thinning toward the poles), zones and belts with wavy edges and sub-bands, a storm spot,
 * limb darkening, a terminator, a lit-limb glow, rings with a Cassini gap and a shadow, a halo in
 * dark mode and engraved hatching on the night side in light mode. Drawn in local coordinates and
 * wrapped in a slow two-axis hover.
 */
export function drawPlanet(b: Placed, ctx: DrawContext, detail = { subBands: true }): string {
  const { ink, langs, uid, shared } = ctx;
  const shape = planetShape(b.seed, b.repo.total, b.r * b.k);
  const { r, tilt } = shape;
  const id = uid("p");
  const sinE = 0.3;
  const cosE = Math.sqrt(1 - sinE * sinE);
  const mixList = langs.mixOf(b.repo).filter((m) => m.share > 0.02);
  const primary = langs.primaryOf(b.repo);
  const mixTotal = mixList.reduce((a, m) => a + m.share, 0) || 1;
  const pick = (t: number) => {
    let acc = 0;
    for (const m of mixList) {
      acc += m.share / mixTotal;
      if (t <= acc) return m.key;
    }
    return mixList[0]?.key ?? primary;
  };
  const base = (key: string | null, theme: Theme) => {
    const c = colorOf(langs, key, theme);
    return theme === "light" ? c : adjust(c, { s: -0.08 });
  };
  const both = (f: (theme: Theme) => string) => th(f("light"), f("dark"));

  const count = Math.min(13, Math.max(5, Math.round(r / 1.5) + 3));
  // latitude boundaries in sin(latitude), top (+1) to bottom (−1), jittered
  const s = [1];
  for (let i = 1; i < count; i++) s.push(1 - (2 * i) / count + (hash(b.seed, i, 11) - 0.5) * (1.3 / count));
  s.push(-1);
  // the front half of a latitude circle, extended flat toward the limb so bands cover the disc
  const seg = r > 8 ? 10 : 7;
  const curve = (sv: number, wav: number, ph: number) => {
    const rho = r * Math.sqrt(Math.max(0, 1 - sv * sv));
    const pts: [number, number][] = [[-r * 1.3, -r * sv * cosE]];
    for (let j = 0; j <= seg; j++) {
      const a = Math.PI - (Math.PI * j) / seg;
      pts.push([rho * Math.cos(a), -r * sv * cosE + rho * sinE * Math.sin(a) + wav * Math.sin(a * 5 + ph)]);
    }
    pts.push([r * 1.3, pts[pts.length - 1]![1]]);
    return pts;
  };
  const toD = (pts: [number, number][]) => poly(pts);

  const bands: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = pick(((i + 0.5) / count + hash(b.seed, 2, 13) * 0.37) % 1);
    const zone = i % 2 === 0;
    const shade = (zone ? 0.05 : -0.06) + (hash(b.seed, i, 17) - 0.5) * 0.08;
    const col = both((theme) => adjust(base(key, theme), { l: shade }));
    const wav = r * 0.035 * (0.5 + hash(b.seed, i, 19));
    const top: [number, number][] = i === 0 ? [[-r * 1.3, -r * 1.4], [r * 1.3, -r * 1.4]] : curve(s[i]!, wav, i * 1.7);
    const bot: [number, number][] = i === count - 1 ? [[r * 1.3, r * 1.4], [-r * 1.3, r * 1.4]] : curve(s[i + 1]!, wav, (i + 1) * 1.7).reverse();
    bands.push(ink.el("path", { d: poly([...top, ...bot], true), fill: col }));
    if (detail.subBands && r > 7 && i > 0 && i < count - 1) {
      const sm = s[i]! + (s[i + 1]! - s[i]!) * (0.35 + 0.3 * hash(b.seed, i, 23));
      bands.push(
        ink.el("path", {
          d: toD(curve(sm, wav * 1.4, i * 2.3).slice(1, -1)),
          fill: "none",
          stroke: both((theme) => adjust(adjust(base(key, theme), { l: shade }), { l: zone ? -0.1 : 0.12 })),
          "stroke-opacity": th(0.55, 0.45),
          "stroke-width": n(Math.max(0.35, r * 0.05)),
        }),
      );
    }
  }
  if (b.repo.total >= STORM_AT) {
    const at = Math.floor(count * 0.62);
    const sv = (s[at]! + s[at + 1]!) / 2;
    const rho = r * Math.sqrt(1 - sv * sv);
    const a = Math.PI * (0.38 + 0.2 * hash(b.seed, 5, 29));
    bands.push(
      ink.el("ellipse", {
        cx: n(rho * Math.cos(a)),
        cy: n(-r * sv * cosE + rho * sinE * Math.sin(a)),
        rx: n(r * 0.2),
        ry: n(r * 0.1),
        fill: both((theme) => mix(base(primary, theme), "#ffffff", 0.32)),
        "fill-opacity": ".85",
        stroke: both((theme) => adjust(base(primary, theme), { l: -0.15 })),
        "stroke-opacity": ".6",
        "stroke-width": n(r * 0.03),
      }),
    );
  }

  const defs = [`<clipPath id="${id}c"><circle r="${n(r)}"/></clipPath>`];
  // shading, shared by every Planet (bounding-box gradients): limb darkening, terminator, lit limb
  const pair = (key: string, make: (theme: Theme, gid: string) => string) =>
    th(
      ink.draws("light") ? `url(#${shared(`${key}L`, (gid) => make("light", gid))})` : "none",
      ink.draws("dark") ? `url(#${shared(`${key}D`, (gid) => make("dark", gid))})` : "none",
    );
  const limb = pair("limb", (theme, gid) => `<radialGradient id="${gid}"><stop offset=".6" stop-opacity="0"/><stop offset="1" stop-opacity="${theme === "light" ? 0.18 : 0.45}"/></radialGradient>`);
  const term = pair(
    "term",
    (theme, gid) =>
      `<radialGradient id="${gid}" cx=".3" cy=".26" r=".95"><stop offset="0" stop-color="#fff" stop-opacity="${theme === "light" ? 0.3 : 0.16}"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-opacity="${theme === "light" ? 0 : 0.3}"/><stop offset="1" stop-opacity="${theme === "light" ? 0 : 0.82}"/></radialGradient>`,
  );
  const rimDark = mix(colorOf(langs, primary, "dark"), "#ffffff", 0.55);
  const rim = pair(`rim${rimDark}`, (theme, gid) => {
    const c = theme === "light" ? INK : rimDark;
    return `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${theme === "light" ? 0.9 : 0.85}"/><stop offset=".5" stop-color="${c}" stop-opacity="${theme === "light" ? 0.55 : 0}"/><stop offset="1" stop-color="${c}" stop-opacity="${theme === "light" ? 0.9 : 0}"/></linearGradient>`;
  });

  let hatch = "";
  if (ink.draws("light")) {
    // engraved night side: parallel hatching clipped to the disc and to the shadowed crescent
    defs.push(`<clipPath id="${id}n"><circle cx="${n(r * 0.42)}" cy="${n(r * 0.36)}" r="${n(r * 0.98)}"/></clipPath>`);
    const lines: string[] = [];
    for (let k = -r * 1.6; k <= r * 1.6; k += Math.max(1.3, r * 0.16)) lines.push(`M${n(k - r)} ${n(-r)}L${n(k + r)} ${n(r)}`);
    hatch = ink.only("light", `<g clip-path="url(#${id}n)"><path d="${lines.join("")}" stroke="${INK}" stroke-opacity=".38" stroke-width=".45" fill="none"/></g>`);
  }
  const disc = `<g transform="rotate(${n(tilt)})">${bands.join("")}</g>`;

  let ringBack = "";
  let ringFront = "";
  let ringShadow = "";
  if (shape.ring) {
    const { inner, outer, squash, tilt: rt } = shape.ring;
    const dusty = (theme: Theme) => (theme === "light" ? INK : mix(base(primary, "dark"), "#efe2c8", 0.55));
    const ringlets = [0.32, 0.55, 0.06, 0.62, 0.45, 0.28, 0.18]; // the third is the Cassini gap
    const draw = (half: string) =>
      ringlets
        .map((op, j) => {
          const rr = inner + (outer - inner) * ((j + 0.5) / ringlets.length);
          return ink.el("ellipse", {
            rx: n(rr),
            ry: n(rr * squash),
            fill: "none",
            stroke: both((theme) => (j % 2 ? dusty(theme) : mix(dusty(theme), theme === "light" ? INK : "#ffffff", 0.2))),
            "stroke-opacity": th(n(op * 1.1, 2), n(op, 2)),
            "stroke-width": th(n(((outer - inner) / ringlets.length) * 0.35, 2), n(((outer - inner) / ringlets.length) * 0.85, 2)),
            "clip-path": `url(#${id}${half})`,
          });
        })
        .join("");
    defs.push(`<clipPath id="${id}b"><rect x="${n(-outer * 1.2)}" y="${n(-outer)}" width="${n(outer * 2.4)}" height="${n(outer)}"/></clipPath>`);
    defs.push(`<clipPath id="${id}f"><rect x="${n(-outer * 1.2)}" width="${n(outer * 2.4)}" height="${n(outer)}"/></clipPath>`);
    // the back half is drawn behind the disc, the front half in front of it
    ringBack = `<g transform="rotate(${n(rt)})">${draw("b")}</g>`;
    ringFront = `<g transform="rotate(${n(rt)})">${draw("f")}</g>`;
    ringShadow = `<g transform="rotate(${n(rt)})">${ink.el("ellipse", { cx: n(r * 0.08), cy: n(r * 0.12), rx: n(inner * 0.98), ry: n(inner * squash), fill: "none", stroke: "#000", "stroke-opacity": th(0.18, 0.35), "stroke-width": n(r * 0.16) })}</g>`;
  }
  let halo = "";
  if (ink.draws("dark")) {
    const c = colorOf(langs, primary, "dark");
    const hg = shared(`halo${c}`, (gid) => `<radialGradient id="${gid}"><stop offset=".72" stop-color="${mix(c, "#ffffff", 0.3)}" stop-opacity=".32"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    halo = ink.only("dark", `<circle r="${n(r * 1.32)}" fill="url(#${hg})"/>`);
  }
  const body =
    `<g clip-path="url(#${id}c)">${disc}${ringShadow}${hatch}${ink.el("circle", { r: n(r), fill: term })}${ink.el("circle", { r: n(r), fill: limb })}</g>` +
    ink.el("circle", { r: n(r - 0.25), fill: "none", stroke: rim, "stroke-width": th(0.7, n(Math.max(0.6, r * 0.07))) });

  // a two-axis hover with periods of its own; the placement translate sits on an inner group
  const hy = `animation-duration:${n(5.5 + hash(b.seed, 4, 37) * 3.5)}s;animation-delay:-${n(hash(b.seed, 5, 37) * 8)}s`;
  const hx = `animation-duration:${n(8 + hash(b.seed, 6, 37) * 5)}s;animation-delay:-${n(hash(b.seed, 7, 37) * 9)}s`;
  return (
    `<g class="hy a${Math.round(hoverAmplitude(r) * 10)}" style="${hy}"><g class="hx" style="${hx}"><g transform="translate(${n(b.x)} ${n(b.y)})">` +
    `<defs>${defs.join("")}</defs>${halo}${ringBack}${body}${ringFront}</g></g></g>`
  );
}
