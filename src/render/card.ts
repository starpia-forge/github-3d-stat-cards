import { middlePeriod, primaryLanguage, type Activity } from "../activity.js";
import type { CardConfig } from "../config.js";
import { TIERS, tierOf } from "../tiers.js";
import { buildTimeline } from "../timeline.js";
import { esc, frame, H, n, W } from "./svg.js";

const MARGIN = 40;
const BAND_Y = 150;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The Milky Way Card (flat Band: Bodies by time position and Tier size). */
export function renderCard(activity: Activity, config: CardConfig): string {
  const repos = activity.repos;
  const t = buildTimeline(repos, new Date(activity.fetchedAt));
  const x = (i: number) => MARGIN + t.pos(i) * (W - 2 * MARGIN);
  const commits = repos.reduce((a, r) => a + r.total, 0);
  const since = `${MONTHS[t.start % 12]} ${Math.floor(t.start / 12)}`;
  const name = config.displayName ?? activity.login;
  const header = `${name} · since ${since} · ${commits} commits · ${repos.length} projects`;

  const rifts = t.rifts
    .map((r) => `<rect x="${n(x(r.from))}" y="${BAND_Y - 6}" width="${n(x(r.to) - x(r.from))}" height="12" fill="#000" fill-opacity=".25"/>`)
    .join("");
  const bodies = repos
    .map((r) => {
      const color = primaryLanguage(r)?.color ?? "#8b949e";
      return `<circle cx="${n(x(middlePeriod(r)))}" cy="${BAND_Y}" r="${n(TIERS[tierOf(r.total)].size)}" fill="${color}" fill-opacity=".85"/>`;
    })
    .join("");

  return frame(
    `Milky Way of ${name}: ${commits} commits across ${repos.length} projects since ${since}`,
    `<g font-family="Inter,system-ui,sans-serif" fill="#8b949e"><text x="${MARGIN}" y="34" font-size="15">${esc(header)}</text></g>` +
      `<line x1="${MARGIN}" y1="${BAND_Y}" x2="${W - MARGIN}" y2="${BAND_Y}" stroke="#8b949e" stroke-opacity=".35"/>` +
      rifts +
      bodies +
      `<text x="${W - MARGIN}" y="${H - 24}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="#8b949e" text-anchor="end">today →</text>`,
  );
}
