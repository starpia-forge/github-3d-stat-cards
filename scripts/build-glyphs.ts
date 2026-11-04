// Build step: turns a fixed glyph repertoire of Fraunces and Inter into path data, so the Card's
// text looks the same everywhere without fonts. Writes src/render/glyphs.generated.ts.
// Usage: npm run glyphs
import { readFileSync, writeFileSync } from "node:fs";
import opentype from "opentype.js";

/** Glyphs are stored at this many units per em (y down, baseline at 0). */
const EM = 24;

const FACES = {
  serif: "node_modules/@fontsource/fraunces/files/fraunces-latin-500-italic.woff",
  sans: "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
  bold: "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
} as const;

/** Printable ASCII, Latin-1 letters, and the symbols the Card uses. */
const LATIN = [...range(0x20, 0x7e), ...range(0xc0, 0xff).filter((c) => c !== 0xd7 && c !== 0xf7)].map((c) => String.fromCodePoint(c));
const SYMBOLS = ["·", "–", "—", "…", "’", "→", "≈"];
export const REPERTOIRE = [...LATIN, ...SYMBOLS];

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const load = (file: string) => {
  const b = readFileSync(file);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
};

/** Symbols missing from the font subsets are drawn here, in the face's own proportions. */
function synth(font: opentype.Font, ch: string): { d: string; adv: number } | undefined {
  const s = EM / font.unitsPerEm;
  const minus = font.charToGlyph("-");
  const bb = minus.getBoundingBox();
  const thick = (bb.y2 - bb.y1) * s;
  const mid = -((bb.y1 + bb.y2) / 2) * s;
  if (ch === "→") {
    const w = EM * 0.62;
    const head = EM * 0.22;
    const x0 = EM * 0.06;
    const t = thick / 2;
    const tip = x0 + w;
    const d = `M${f(x0)} ${f(mid - t)}L${f(tip - head * 0.55)} ${f(mid - t)}L${f(tip - head)} ${f(mid - head + t)}L${f(tip - head + t * 1.4)} ${f(mid - head - t * 0.4)}L${f(tip + t * 0.4)} ${f(mid)}L${f(tip - head + t * 1.4)} ${f(mid + head + t * 0.4)}L${f(tip - head)} ${f(mid + head - t)}L${f(tip - head * 0.55)} ${f(mid + t)}L${f(x0)} ${f(mid + t)}Z`;
    return { d, adv: tip + EM * 0.1 };
  }
  if (ch === "≈") {
    const tilde = font.charToGlyph("~");
    const gap = EM * 0.13;
    const up = absolute(tilde.getPath(0, 0, EM));
    const shift = (d: string, dy: number) =>
      d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, cmd: string, args: string) => {
        const nums = numbers(args);
        return cmd + nums.map((v, i) => f(i % 2 ? v + dy : v)).join(" ");
      });
    const tb = tilde.getBoundingBox();
    const tmid = -((tb.y1 + tb.y2) / 2) * s;
    return { d: shift(up, mid - tmid - gap) + shift(up, mid - tmid + gap), adv: tilde.advanceWidth! * s };
  }
  return undefined;
}

/** Absolute path data with explicit separators (opentype.js's own output can run numbers together). */
const absolute = (path: opentype.Path): string =>
  path.commands
    .map((c: any) => (c.type === "Z" ? "Z" : c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter((v) => v !== undefined).join(" ")))
    .join("");

/** The numbers in a path command's arguments; opentype.js writes them without separators ("1.5-2"). */
const numbers = (args: string): number[] => (args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? []).map(Number);

/**
 * Rewrites absolute path data as compact relative commands. Points are rounded first and the
 * differences taken between rounded points, so rounding never drifts along a contour.
 */
export function compact(d: string): string {
  const r = (v: number) => Math.round(v * 10) / 10;
  const num = (v: number) => {
    const t = r(v).toFixed(1).replace(/\.0$/, "").replace(/^(-?)0\./, "$1.");
    return t === "-0" ? "0" : t;
  };
  // Numbers need a separator unless the next one starts with "-", or starts with "." after a number that already has one.
  const join = (vals: number[]) => {
    let s = "";
    let prev = "";
    for (const v of vals.map(num)) {
      const glue = !prev || v.startsWith("-") || (v.startsWith(".") && prev.includes(".")) ? "" : " ";
      s += glue + v;
      prev = v;
    }
    return s;
  };
  let out = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const [, cmd, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    if (cmd === "Z") {
      out += "z";
      cx = sx;
      cy = sy;
      continue;
    }
    const p = numbers(args!).map(r);
    const rel: number[] = [];
    for (let i = 0; i < p.length; i += 2) rel.push(r(p[i]! - cx), r(p[i + 1]! - cy));
    out += cmd!.toLowerCase() + join(rel);
    cx = p[p.length - 2]!;
    cy = p[p.length - 1]!;
    if (cmd === "M") {
      sx = cx;
      sy = cy;
    }
  }
  return out;
}

const f = (v: number) => {
  const t = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return t === "-0" ? "0" : t;
};

const out: Record<string, { ascent: number; glyphs: Record<string, [string, number]>; kern: Record<string, number> }> = {};
for (const [face, file] of Object.entries(FACES)) {
  const font = load(file);
  const s = EM / font.unitsPerEm;
  const glyphs: Record<string, [string, number]> = {};
  for (const ch of REPERTOIRE) {
    const idx = font.charToGlyphIndex(ch);
    if (idx > 0) {
      const g = font.glyphs.get(idx);
      glyphs[ch] = [compact(absolute(g.getPath(0, 0, EM))), Math.round(g.advanceWidth! * s * 100) / 100];
    } else {
      const made = synth(font, ch);
      if (!made) throw new Error(`${face} has no glyph for ${JSON.stringify(ch)}`);
      glyphs[ch] = [compact(made.d), Math.round(made.adv * 100) / 100];
    }
  }
  const kern: Record<string, number> = {};
  const chars = Object.keys(glyphs).filter((c) => c !== " " && font.charToGlyphIndex(c) > 0);
  for (const a of chars) {
    for (const b of chars) {
      const k = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b));
      if (Math.abs(k * s) >= 0.05) kern[a + b] = Math.round(k * s * 100) / 100;
    }
  }
  out[face] = { ascent: Math.round(font.ascender * s * 100) / 100, glyphs, kern };
  console.log(`${face}: ${Object.keys(glyphs).length} glyphs, ${Object.keys(kern).length} kerning pairs`);
}

writeFileSync(
  "src/render/glyphs.generated.ts",
  `// Generated by scripts/build-glyphs.ts from Fraunces (500 italic) and Inter (400, 700), SIL Open Font License 1.1.\n` +
    `// Do not edit. Glyph paths are at ${EM} units per em, y down, baseline at 0: [path, advance].\n` +
    `export const EM = ${EM};\n` +
    `export const FACES = ${JSON.stringify(out)} as const satisfies Record<string, { ascent: number; glyphs: Record<string, readonly [string, number]>; kern: Record<string, number> }>;\n`,
);
