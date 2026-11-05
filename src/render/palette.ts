import { OTHER, type LanguageKey, type Languages } from "../languages.js";
import { INK, pastel, tune, type Theme } from "./color.js";
import { th, type Themed } from "./ink.js";

/** Other is a neutral grey; uncoloured repositories (no Language left) are silver or ink. */
const OTHER_GREY: Record<Theme, string> = { dark: "#8d96a3", light: "#9b9384" };
const UNCOLOURED: Record<Theme, string> = { dark: "#c9d1d9", light: INK };
/** A Language without a Linguist colour. */
const NO_LINGUIST = "#8b949e";

/** The colour of a Language key: Linguist hues, lifted in dark mode, mixed toward white (pastel) in light mode. */
export function colorOf(l: Languages, key: LanguageKey, theme: Theme): string {
  if (key === null) return UNCOLOURED[theme];
  if (key === OTHER) return OTHER_GREY[theme];
  const base = tune(l.top.find((t) => t.name === key)?.color ?? NO_LINGUIST, theme);
  return theme === "light" ? pastel(base) : base;
}

/** The colour of a Language key in both themes. */
export const themedColor = (l: Languages, key: LanguageKey): Themed => th(colorOf(l, key, "light"), colorOf(l, key, "dark"));
