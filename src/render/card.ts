import type { Activity } from "../activity.js";
import type { CardConfig } from "../config.js";
import { buildLanguages } from "../languages.js";
import { buildTimeline } from "../timeline.js";
import { drawBackground, drawBand, drawGrid, FULL_DENSITY } from "./band.js";
import type { Theme } from "./color.js";
import { drawStar, drawStarlight, type DrawContext } from "./bodies.js";
import { Ink } from "./ink.js";
import { drawBandLabels, drawHeader, drawLanguageLegend, drawTierLegend, headerLine, headerName, monthLabel, percent } from "./labels.js";
import { drawOrder, placeBodies } from "./place.js";
import { drawPlanet } from "./planet.js";
import { drawNebula, nebulaLabel } from "./nebula.js";
import { motionCss, stripTiming } from "./motion.js";
import { frame } from "./svg.js";
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
    approximate: activity.complete === false,
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
  const placed = drawOrder(placeBodies(repos, t));
  const bodies = placed
    .map((b) => {
      if (b.tier === "starlight") return drawStarlight(b, ctx);
      if (b.tier === "star") return drawStar(b, ctx);
      if (b.tier === "planet") return drawPlanet(b, ctx);
      return drawNebula(b, ctx);
    })
    .join("");
  const names = placed.filter((b) => b.tier === "nebula").map((b) => nebulaLabel(b, tw, activity.login)).join("");
  const labels = names + drawHeader(tw, facts) + drawTierLegend(ink, tw) + drawLanguageLegend(ink, tw, langs) + drawBandLabels(tw, t, band.glow);

  const recent = langs.empty ? "no commits in the last 12 months" : `last 12 months: ${langs.legend.map((e) => `${e.key} ${percent(e.share)}`).join(", ")}`;
  const summary = `${facts.name}'s Milky Way: ${headerLine(facts)}; ${recent}`;
  const svg = frame(summary, background + grid + band.svg + bodies + labels, `<style>${motionCss(options.animate)}${ink.css()}</style><defs>${defs.join("")}${tw.glyphDefs()}</defs>`);
  return options.animate ? svg : stripTiming(svg);
}
