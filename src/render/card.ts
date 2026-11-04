import { middlePeriod, primaryLanguage, type Activity } from "../activity.js";
import type { CardConfig } from "../config.js";
import { TIERS, tierOf } from "../tiers.js";
import { buildTimeline } from "../timeline.js";
import { drawBackground, drawBand, drawGrid, FULL_DENSITY } from "./band.js";
import { INK, tune, type Theme } from "./color.js";
import { gauss, seedOf } from "./hash.js";
import { Ink, th } from "./ink.js";
import { bandY, flatX, project } from "./scene.js";
import { esc, frame, n } from "./svg.js";

export interface RenderOptions {
  /** A forced theme, or `auto` to follow `prefers-color-scheme`. */
  theme: Theme | "auto";
  animate: boolean;
}

export const DEFAULT_OPTIONS: RenderOptions = { theme: "auto", animate: true };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const TEXT = th("#1f2328", "#e6edf3");
export const SUB = th("#59636e", "#9aa4b0");

/** The Milky Way Card. */
export function renderCard(activity: Activity, config: CardConfig, options: RenderOptions = DEFAULT_OPTIONS): string {
  const ink = new Ink(options.theme);
  let ids = 0;
  const uid = (tag: string) => `${tag}${(ids++).toString(36)}`;
  const repos = activity.repos;
  const t = buildTimeline(repos, new Date(activity.fetchedAt));
  const commits = repos.reduce((a, r) => a + r.total, 0);
  const since = `${MONTHS[t.start % 12]} ${Math.floor(t.start / 12)}`;
  const name = config.displayName ?? activity.login;

  const background = drawBackground(ink, FULL_DENSITY);
  const grid = drawGrid(ink, t);
  const band = drawBand(ink, t, FULL_DENSITY, uid);
  const bodies = repos
    .map((r) => {
      const x = flatX(t, middlePeriod(r));
      const q = project(x, bandY(x) + Math.max(-84, Math.min(84, gauss(seedOf(r.key)) * 30)));
      const base = primaryLanguage(r)?.color ?? "#8b949e";
      return ink.el("circle", { cx: n(q.x), cy: n(q.y), r: n(TIERS[tierOf(r.total)].size * q.k), fill: th(tune(base, "light"), tune(base, "dark")), stroke: th(INK, "none"), "stroke-width": ".6" });
    })
    .join("");
  const text = (x: number, y: number, s: string, size: number, fill = SUB, extra = "") =>
    ink.el("text", { x, y, "font-size": size, fill, "font-family": "Inter,system-ui,sans-serif" }, esc(s)).replace("<text ", `<text ${extra}`);
  const labels =
    text(18, 32, name, 23, TEXT, 'font-style="italic" ') +
    text(18, 53, `since ${since} · ${commits.toLocaleString("en-US")} commits · ${repos.length} projects`, 11);

  const label = `Milky Way of ${name}: ${commits} commits across ${repos.length} projects since ${since}`;
  return frame(label, background + grid + band.svg + bodies + labels, `<style>${ink.css()}</style>`);
}
