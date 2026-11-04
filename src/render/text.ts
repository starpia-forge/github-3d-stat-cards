import { EM, FACES } from "./glyphs.generated.js";
import type { Ink, Value } from "./ink.js";
import { n } from "./svg.js";

/** `serif` is Fraunces italic (the name), `sans` and `bold` are Inter. */
export type Face = keyof typeof FACES;

const ELLIPSIS = "…";
const glyphOf = (face: Face, ch: string) => (FACES[face].glyphs as Record<string, readonly [string, number]>)[ch];
const kernOf = (face: Face, pair: string) => (FACES[face].kern as Record<string, number>)[pair] ?? 0;

/** Whether every character of `s` is in the face's repertoire. */
export const canDraw = (s: string, face: Face): boolean => [...s].every((ch) => glyphOf(face, ch) !== undefined);

/** Width of `s` at `size` px. Characters outside the repertoire are measured as `?`. */
export function measure(s: string, face: Face, size: number): number {
  const chars = [...s];
  let w = 0;
  chars.forEach((ch, i) => {
    w += (glyphOf(face, ch) ?? glyphOf(face, "?")!)[1];
    if (i) w += kernOf(face, chars[i - 1]! + ch);
  });
  return (w * size) / EM;
}

/** Cuts `s` to `max` px wide, ending in an ellipsis when anything was cut. */
export function fit(s: string, face: Face, size: number, max: number): string {
  if (measure(s, face, size) <= max) return s;
  const chars = [...s];
  while (chars.length && measure(chars.join("").trimEnd() + ELLIPSIS, face, size) > max) chars.pop();
  return chars.join("").trimEnd() + ELLIPSIS;
}

export interface TextStyle {
  face: Face;
  size: number;
  fill: Value;
  opacity?: Value;
  anchor?: "start" | "middle" | "end";
  /** Cut to this width with an ellipsis. */
  maxWidth?: number;
}

/**
 * Draws text as paths. Each glyph is defined once per SVG (in `<defs>`) and reused with `<use>`,
 * so a repeated letter costs a few bytes.
 */
export class TextWriter {
  private defined = new Map<string, string>();
  private defs: string[] = [];

  constructor(private ink: Ink) {}

  private glyphId(face: Face, ch: string): string | undefined {
    const key = face + ch;
    let id = this.defined.get(key);
    if (id) return id;
    const g = glyphOf(face, ch) ?? glyphOf(face, "?")!;
    if (!g[0]) return undefined; // a space
    id = `${face[0]}${this.defined.size.toString(36)}`;
    this.defined.set(key, id);
    this.defs.push(`<path id="${id}" d="${g[0]}"/>`);
    return id;
  }

  draw(x: number, y: number, raw: string, style: TextStyle): string {
    const s = style.maxWidth ? fit(raw, style.face, style.size, style.maxWidth) : raw;
    const w = measure(s, style.face, style.size);
    const x0 = style.anchor === "middle" ? x - w / 2 : style.anchor === "end" ? x - w : x;
    const chars = [...s];
    let pen = 0;
    const uses: string[] = [];
    chars.forEach((ch, i) => {
      if (i) pen += kernOf(style.face, chars[i - 1]! + ch);
      const id = this.glyphId(style.face, ch);
      if (id) uses.push(`<use href="#${id}"${pen ? ` x="${n(pen)}"` : ""}/>`);
      pen += (glyphOf(style.face, ch) ?? glyphOf(style.face, "?")!)[1];
    });
    if (!uses.length) return "";
    const scale = style.size / EM;
    return this.ink.el("g", { transform: `translate(${n(x0)} ${n(y)}) scale(${n(scale, 4)})`, fill: style.fill, "fill-opacity": style.opacity }, uses.join(""));
  }

  /** The glyph definitions used so far. */
  glyphDefs(): string {
    return this.defs.join("");
  }
}
