import type { Languages } from "../languages.js";
import type { Timeline } from "../timeline.js";
import { yearBoundaries } from "./band.js";
import { INK } from "./color.js";
import { th, type Ink } from "./ink.js";
import { themedColor } from "./palette.js";
import { bandY, BX1, flatX, project, type Glow } from "./scene.js";
import { H, n, W } from "./svg.js";
import { canDraw, measure, type TextWriter } from "./text.js";

export const TEXT = th("#1f2328", "#e6edf3");
export const SUB = th("#59636e", "#9aa4b0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthLabel = (index: number): string => `${MONTHS[index % 12]} ${Math.floor(index / 12)}`;

/** The name in the header: `displayName` when every character can be drawn, otherwise the login. */
export const headerName = (login: string, displayName: string | undefined): string =>
  displayName && canDraw(displayName, "serif") ? displayName : login;

export interface HeaderFacts {
  name: string;
  since: string;
  commits: number;
  projects: number;
  /** History is incomplete: the commit count is a lower bound. */
  approximate?: boolean;
}

export const headerLine = (f: HeaderFacts): string =>
  `since ${f.since} · ${f.approximate ? "≈" : ""}${f.commits.toLocaleString("en-US")} commits · ${f.projects} projects`;

/** Header: the name in Fraunces italic, the facts beneath in Inter. */
export function drawHeader(tw: TextWriter, f: HeaderFacts): string {
  return (
    tw.draw(18, 32, f.name, { face: "serif", size: 23, fill: TEXT, maxWidth: 600 }) +
    tw.draw(18, 53, headerLine(f), { face: "sans", size: 11, fill: SUB, maxWidth: 600 })
  );
}

/** The Tier legend, bottom left; it doubles as the caption that explains the measure. */
export function drawTierLegend(ink: Ink, tw: TextWriter): string {
  const ty = H - 16;
  const cy = ty - 4;
  const col = th(INK, "#e6edf3");
  const out: string[] = [];
  let cx = 22;
  const icons = [
    { tier: "starlight", label: "1–9" },
    { tier: "star", label: "10–49" },
    { tier: "planet", label: "50–199" },
    { tier: "nebula", label: "200+ commits per project" },
  ];
  for (const ic of icons) {
    if (ic.tier === "starlight") out.push(ink.el("circle", { cx: n(cx), cy: n(cy), r: 1.6, fill: col }));
    if (ic.tier === "star")
      out.push(
        ink.el("path", { d: `M${n(cx - 5)} ${n(cy)}H${n(cx + 5)}M${n(cx)} ${n(cy - 5)}V${n(cy + 5)}`, stroke: col, "stroke-width": ".9" }),
        ink.el("circle", { cx: n(cx), cy: n(cy), r: 1.8, fill: col }),
      );
    if (ic.tier === "planet")
      out.push(
        ink.el("circle", { cx: n(cx), cy: n(cy), r: 4, fill: "none", stroke: col, "stroke-width": ".9" }),
        ink.el("ellipse", { cx: n(cx), cy: n(cy), rx: 7, ry: 2, fill: "none", stroke: col, "stroke-width": ".7", transform: `rotate(-16 ${n(cx)} ${n(cy)})` }),
      );
    if (ic.tier === "nebula")
      out.push(
        ink.el("ellipse", { cx: n(cx), cy: n(cy), rx: 7, ry: 4, fill: col, "fill-opacity": ".35" }),
        ink.el("ellipse", { cx: n(cx + 3), cy: n(cy - 1), rx: 4, ry: 3, fill: col, "fill-opacity": ".35" }),
      );
    const lx = cx + (ic.tier === "planet" || ic.tier === "nebula" ? 11 : 8);
    out.push(tw.draw(lx, ty, ic.label, { face: "sans", size: 10, fill: SUB }));
    cx = lx + measure(ic.label, "sans", 10) + 16;
  }
  return out.join("");
}

/** Year ticks under the Band (skipping any that would collide), "today →", and Rift labels. */
export function drawBandLabels(tw: TextWriter, t: Timeline, glow: Glow): string {
  const out: string[] = [];
  const style = { face: "sans" as const, size: 10, fill: SUB, opacity: 0.9 };
  const ticks: { index: number; label: string; anchor: "start" | "middle" }[] = [{ index: t.start, label: monthLabel(t.start), anchor: "start" }];
  for (const y of yearBoundaries(t)) ticks.push({ index: y * 12, label: String(y), anchor: "middle" });
  let lastRight = -Infinity;
  for (const tick of ticks) {
    const x = flatX(t, tick.index);
    const q = project(x, Math.min(244, bandY(x) + glow.half(x) + 30));
    const w = measure(tick.label, "sans", 10);
    const left = tick.anchor === "start" ? q.x : q.x - w / 2;
    if (left < lastRight + 8) continue;
    lastRight = left + w;
    out.push(tw.draw(q.x, q.y, tick.label, { ...style, anchor: tick.anchor }));
  }
  const today = project(BX1, bandY(BX1) - glow.half(BX1) - 22);
  out.push(tw.draw(today.x + 4, today.y, "today →", { ...style, anchor: "end" }));
  for (const r of t.rifts) {
    const x = flatX(t, (r.from + r.to) / 2);
    const q = project(x, bandY(x) - glow.half(x) - 6);
    const label = `${r.months} mo quiet`;
    // kept inside the canvas: a Rift near the far end sits close to the left edge
    const half = measure(label, "sans", style.size) / 2;
    out.push(tw.draw(Math.max(4 + half, Math.min(W - 4 - half, q.x)), q.y, label, { ...style, anchor: "middle" }));
  }
  return out.join("");
}


/** Share as shown in the legend. */
export const percent = (share: number): string => (share > 0 && share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`);

/** The language legend, right column: "last 12 months", the top six plus Other with their shares. */
export function drawLanguageLegend(ink: Ink, tw: TextWriter, langs: Languages): string {
  const lx = 668;
  const y0 = 66;
  const out = [tw.draw(lx, y0 - 16, "last 12 months", { face: "sans", size: 9.5, fill: SUB, opacity: 0.9 })];
  if (langs.empty) {
    out.push(tw.draw(lx, y0, "No commits in the", { face: "sans", size: 11, fill: SUB }), tw.draw(lx, y0 + 15, "last 12 months", { face: "sans", size: 11, fill: SUB }));
    return out.join("");
  }
  langs.legend.forEach((e, i) => {
    const y = y0 + i * 18;
    out.push(ink.el("circle", { cx: lx + 4, cy: y - 4, r: 4, fill: themedColor(langs, e.key), stroke: th(INK, "none"), "stroke-width": ".7" }));
    out.push(tw.draw(lx + 14, y, e.key, { face: "sans", size: 12, fill: TEXT, maxWidth: 104 }));
    out.push(tw.draw(lx + 156, y, percent(e.share), { face: "bold", size: 12, fill: TEXT, anchor: "end" }));
  });
  return out.join("");
}

/** Below this rendered width (CSS px of the image) the Card switches to its narrow layout. */
export const NARROW_MAX_WIDTH = 480;
/** Narrow text is this much larger, so it stays readable at about 300 px. */
const NARROW_SCALE = 2.1;

/**
 * Narrow layout (phones): fewer, larger labels — the header and the top three Languages — beside
 * the scene, which shrinks into the lower left. Everything else is hidden by the media query.
 */
export function drawNarrowLabels(ink: Ink, tw: TextWriter, f: HeaderFacts, langs: Languages): string {
  const s = NARROW_SCALE;
  const out = [
    tw.draw(18, 50, f.name, { face: "serif", size: 23 * s, fill: TEXT, maxWidth: 810 }),
    tw.draw(18, 50 + 21 * s, headerLine(f), { face: "sans", size: 11 * s, fill: SUB, maxWidth: 810 }),
  ];
  const lx = 428;
  if (langs.empty) {
    out.push(tw.draw(lx, 170, "No commits in the", { face: "sans", size: 11 * s, fill: SUB }), tw.draw(lx, 170 + 14 * s, "last 12 months", { face: "sans", size: 11 * s, fill: SUB }));
    return out.join("");
  }
  [...langs.legend]
    .sort((a, b) => b.share - a.share)
    .slice(0, 3)
    .forEach((e, i) => {
      const y = 150 + i * 36;
      out.push(ink.el("circle", { cx: n(lx + 4 * s), cy: n(y - 4 * s), r: n(4 * s), fill: themedColor(langs, e.key), stroke: th(INK, "none"), "stroke-width": "1.2" }));
      out.push(tw.draw(lx + 14 * s, y, e.key, { face: "sans", size: 12 * s, fill: TEXT, maxWidth: 250 }));
      out.push(tw.draw(lx + 400, y, percent(e.share), { face: "bold", size: 12 * s, fill: TEXT, anchor: "end" }));
    });
  return out.join("");
}

/** Switches between the wide and the narrow layout by the image's own rendered width. */
export const NARROW_CSS = `.nw{display:none}@media (max-width:${NARROW_MAX_WIDTH}px){.wd{display:none}.nw{display:inline}.sc{transform:translate(2px,85px) scale(.62)}}`;
