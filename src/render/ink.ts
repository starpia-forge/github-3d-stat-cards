import type { Theme } from "./color.js";

/** A value that differs between the light and the dark theme. */
export interface Themed {
  light: string | number;
  dark: string | number;
}
export type Value = string | number | Themed | undefined | null | false;

export const th = (light: string | number, dark: string | number): Themed => ({ light, dark });

/** Properties that may be themed; each is both an SVG presentation attribute and a CSS property. */
const THEMABLE = new Set(["fill", "stroke", "stop-color", "stop-opacity", "fill-opacity", "stroke-opacity", "stroke-width", "filter", "opacity"]);

/**
 * Writes SVG elements whose paint depends on the theme.
 *
 * With a forced theme, every themed value is resolved and written as a plain attribute.
 * With `auto`, one geometry serves both themes: a themed value becomes a short class whose
 * CSS rule holds the light value, overridden under `prefers-color-scheme: dark`. Elements that
 * belong to one theme only are hidden in the other.
 */
export class Ink {
  private rules = new Map<string, { cls: string; prop: string; light: string; dark: string }>();

  constructor(readonly mode: Theme | "auto") {}

  /** Whether elements meant only for `theme` are drawn at all. */
  draws(theme: Theme): boolean {
    return this.mode === "auto" || this.mode === theme;
  }

  /** One element. `class` is kept first; `only` drops it from the other theme. */
  el(tag: string, attrs: Record<string, Value>, children?: string, only?: Theme): string {
    if (only && !this.draws(only)) return "";
    const classes: string[] = [];
    let out = `<${tag}`;
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false || k === "class") continue;
      if (typeof v === "object") {
        if (this.mode !== "auto") {
          out += ` ${k}="${v[this.mode]}"`;
        } else if (v.light === v.dark) {
          out += ` ${k}="${v.light}"`;
        } else {
          if (!THEMABLE.has(k)) throw new Error(`${k} cannot be themed`);
          classes.push(this.rule(k, String(v.light), String(v.dark)));
        }
      } else {
        out += ` ${k}="${v}"`;
      }
    }
    if (attrs.class) classes.unshift(String(attrs.class));
    if (only && this.mode === "auto") classes.push(only === "light" ? "oL" : "oD");
    if (classes.length) out += ` class="${classes.join(" ")}"`;
    return children === undefined ? `${out}/>` : `${out}>${children}</${tag}>`;
  }

  /** A group drawn in one theme only. */
  only(theme: Theme, children: string): string {
    if (!children || !this.draws(theme)) return "";
    return this.mode === "auto" ? `<g class="${theme === "light" ? "oL" : "oD"}">${children}</g>` : children;
  }

  private rule(prop: string, light: string, dark: string): string {
    const key = `${prop}|${light}|${dark}`;
    let r = this.rules.get(key);
    if (!r) {
      r = { cls: `k${this.rules.size.toString(36)}`, prop, light, dark };
      this.rules.set(key, r);
    }
    return r.cls;
  }

  /** The stylesheet for themed classes (empty with a forced theme). */
  css(): string {
    if (this.mode !== "auto") return "";
    const lights: string[] = [".oD{display:none}"];
    const darks: string[] = [".oL{display:none}.oD{display:inline}"];
    for (const r of this.rules.values()) {
      lights.push(`.${r.cls}{${r.prop}:${r.light}}`);
      darks.push(`.${r.cls}{${r.prop}:${r.dark}}`);
    }
    return `${lights.join("")}@media (prefers-color-scheme:dark){${darks.join("")}}`;
  }
}
