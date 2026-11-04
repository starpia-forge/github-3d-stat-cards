/** Colour arithmetic for the Card's palettes. All colours are `#rrggbb`. */
export type Theme = "light" | "dark";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const rgb = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const hex = (c: number[]) => "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");

export const mix = (a: string, b: string, t: number): string => {
  const A = rgb(a);
  const B = rgb(b);
  return hex(A.map((v, i) => lerp(v, B[i]!, t)));
};

function toHsl([r, g, b]: number[]): [number, number, number] {
  r! /= 255;
  g! /= 255;
  b! /= 255;
  const R = r!, G = g!, B = b!;
  const mx = Math.max(R, G, B);
  const mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]: number[]): number[] {
  if (s === 0) return [l! * 255, l! * 255, l! * 255];
  const q = l! < 0.5 ? l! * (1 + s!) : l! + s! - l! * s!;
  const p = 2 * l! - q;
  const t = (x: number) => {
    x = (x + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [t(h! + 1 / 3) * 255, t(h!) * 255, t(h! - 1 / 3) * 255];
}

/** Shifts lightness and saturation (both −1…1, additive in HSL). */
export const adjust = (c: string, { l = 0, s = 0 }: { l?: number; s?: number }): string => {
  const [h, S, L] = toHsl(rgb(c));
  return hex(fromHsl([h, clamp(S + s, 0, 1), clamp(L + l, 0, 1)]));
};

export const lightness = (c: string): number => toHsl(rgb(c))[2];

/** Ink of the light-mode star atlas. */
export const INK = "#2f343c";

/** A pastel wash of a colour, for the light-mode atlas. */
export const pastel = (c: string): string => mix(c, "#ffffff", 0.42);

/** A Linguist hue tuned for the theme: dark mode lifts dark hues; light mode tames very light ones. */
export function tune(base: string, theme: Theme): string {
  if (theme === "dark") return adjust(base, { l: lightness(base) < 0.4 ? 0.2 : 0.06, s: 0.05 });
  return adjust(base, { l: lightness(base) > 0.6 ? -0.08 : 0 });
}
