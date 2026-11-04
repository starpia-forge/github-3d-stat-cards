import { middlePeriod, type Activity } from "../activity.js";
import type { CardConfig } from "../config.js";
import { buildLanguages } from "../languages.js";
import { TIERS, tierOf } from "../tiers.js";
import { buildTimeline } from "../timeline.js";
import { drawBackground, drawBand, drawGrid, FULL_DENSITY } from "./band.js";
import { INK, type Theme } from "./color.js";
import { gauss, seedOf } from "./hash.js";
import { Ink, th } from "./ink.js";
import { drawBandLabels, drawHeader, drawLanguageLegend, drawTierLegend, headerLine, headerName, monthLabel, percent } from "./labels.js";
import { themedColor } from "./palette.js";
import { bandY, flatX, project } from "./scene.js";
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
  const bodies = repos
    .map((r) => {
      const x = flatX(t, middlePeriod(r));
      const q = project(x, bandY(x) + Math.max(-84, Math.min(84, gauss(seedOf(r.key)) * 30)));
      return ink.el("circle", { cx: n(q.x), cy: n(q.y), r: n(TIERS[tierOf(r.total)].size * q.k), fill: themedColor(langs, langs.primaryOf(r)), stroke: th(INK, "none"), "stroke-width": ".6" });
    })
    .join("");
  const labels = drawHeader(tw, facts) + drawTierLegend(ink, tw) + drawLanguageLegend(ink, tw, langs) + drawBandLabels(tw, t, band.glow);

  const recent = langs.empty ? "no commits in the last 12 months" : `last 12 months: ${langs.legend.map((e) => `${e.key} ${percent(e.share)}`).join(", ")}`;
  const summary = `${facts.name}'s Milky Way: ${headerLine(facts)}; ${recent}`;
  return frame(summary, background + grid + band.svg + bodies + labels, `<style>${ink.css()}</style><defs>${tw.glyphDefs()}</defs>`);
}
