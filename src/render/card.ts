import type { Activity } from "../activity.js";
import type { CardConfig } from "../config.js";
import { buildLanguages } from "../languages.js";
import { TIERS } from "../tiers.js";
import { buildTimeline } from "../timeline.js";
import { drawBackground, drawBand, drawGrid, FULL_DENSITY } from "./band.js";
import { INK, type Theme } from "./color.js";
import { drawStar, drawStarlight, type DrawContext } from "./bodies.js";
import { Ink, th } from "./ink.js";
import { drawBandLabels, drawHeader, drawLanguageLegend, drawTierLegend, headerLine, headerName, monthLabel, percent } from "./labels.js";
import { themedColor } from "./palette.js";
import { placeBodies } from "./place.js";
import { frame, n } from "./svg.js";
import { TextWriter } from "./text.js";

export interface RenderOptions {
  /** A forced theme, or `auto` to follow `prefers-color-scheme`. */
  theme: Theme | "auto";
  animate: boolean;
}

export const DEFAULT_OPTIONS: RenderOptions = { theme: "auto", animate: true };

/** The Milky Way Card. */
export function renderCard(activity: Activity, config: CardConfig, options: RenderOptions = DEFAULT_OPTIONS): string {
  const ink = new Ink(options.theme);
  const tw = new TextWriter(ink);
  let ids = 0;
  const uid = (tag: string) => `${tag}${(ids++).toString(36)}`;
  const repos = activity.repos;
  const now = new Date(activity.fetchedAt);
  const t = buildTimeline(repos, now);
  const langs = buildLanguages(repos, config.hide, now);
  const facts = {
    name: headerName(activity.login, config.displayName),
    since: monthLabel(t.start),
    commits: repos.reduce((a, r) => a + r.total, 0),
    projects: repos.length,
  };

  const background = drawBackground(ink, FULL_DENSITY);
  const grid = drawGrid(ink, t);
  const band = drawBand(ink, t, FULL_DENSITY, uid);
  const defs: string[] = [];
  const sharedIds = new Map<string, string>();
  const ctx: DrawContext = {
    ink,
    langs,
    uid,
    shared: (key, make) => {
      let id = sharedIds.get(key);
      if (!id) {
        id = uid("g");
        sharedIds.set(key, id);
        defs.push(make(id));
      }
      return id;
    },
  };
  const order = { starlight: 0, star: 1, nebula: 2, planet: 3 };
  const placed = placeBodies(repos, t).sort((a, b) => order[a.tier] - order[b.tier] || a.k - b.k || a.repo.key.localeCompare(b.repo.key));
  const bodies = placed
    .map((b) => {
      if (b.tier === "starlight") return drawStarlight(b, ctx);
      if (b.tier === "star") return drawStar(b, ctx);
      // Planets and Nebulae: placeholders until their own drawings land
      return ink.el("circle", { cx: n(b.x), cy: n(b.y), r: n(TIERS[b.tier].size * b.k), fill: themedColor(langs, langs.primaryOf(b.repo)), stroke: th(INK, "none"), "stroke-width": ".6" });
    })
    .join("");
  const labels = drawHeader(tw, facts) + drawTierLegend(ink, tw) + drawLanguageLegend(ink, tw, langs) + drawBandLabels(tw, t, band.glow);

  const recent = langs.empty ? "no commits in the last 12 months" : `last 12 months: ${langs.legend.map((e) => `${e.key} ${percent(e.share)}`).join(", ")}`;
  const summary = `${facts.name}'s Milky Way: ${headerLine(facts)}; ${recent}`;
  return frame(summary, background + grid + band.svg + bodies + labels, `<style>${ink.css()}</style><defs>${defs.join("")}${tw.glyphDefs()}</defs>`);
}
