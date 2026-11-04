import { middlePeriod, periodIndex, periodOf, primaryLanguage, type Activity } from "../activity.js";
import type { CardConfig } from "../config.js";
import { esc, frame, H, n, W } from "./svg.js";

const MARGIN = 40;
const BAND_Y = 150;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The Milky Way Card (walking skeleton: a flat Band with one dot per repository). */
export function renderCard(activity: Activity, config: CardConfig): string {
  const repos = activity.repos;
  const first = Math.min(...repos.flatMap((r) => Object.keys(r.months).map(periodIndex)));
  const end = periodIndex(periodOf(new Date(activity.fetchedAt))) + 1;
  const x = (i: number) => MARGIN + ((i - first) / Math.max(1, end - first)) * (W - 2 * MARGIN);
  const commits = repos.reduce((a, r) => a + r.total, 0);
  const since = `${MONTHS[first % 12]} ${Math.floor(first / 12)}`;
  const name = config.displayName ?? activity.login;
  const header = `${name} · since ${since} · ${commits} commits · ${repos.length} projects`;

  const dots = repos
    .map((r) => {
      const color = primaryLanguage(r)?.color ?? "#8b949e";
      const radius = 2 + Math.min(6, Math.sqrt(r.total) / 2);
      return `<circle cx="${n(x(middlePeriod(r)))}" cy="${BAND_Y}" r="${n(radius)}" fill="${color}" fill-opacity=".85"/>`;
    })
    .join("");

  return frame(
    `Milky Way of ${name}: ${commits} commits across ${repos.length} projects since ${since}`,
    `<g font-family="Inter,system-ui,sans-serif" fill="#8b949e"><text x="${MARGIN}" y="34" font-size="15">${esc(header)}</text></g>` +
      `<line x1="${MARGIN}" y1="${BAND_Y}" x2="${W - MARGIN}" y2="${BAND_Y}" stroke="#8b949e" stroke-opacity=".35"/>` +
      dots +
      `<text x="${W - MARGIN}" y="${H - 24}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="#8b949e" text-anchor="end">today →</text>`,
  );
}
