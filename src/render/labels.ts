import type { Timeline } from "../timeline.js";
import { yearBoundaries } from "./band.js";
import { INK } from "./color.js";
import { th, type Ink } from "./ink.js";
import { bandY, BX1, flatX, project, type Glow } from "./scene.js";
import { H, n } from "./svg.js";
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
    out.push(tw.draw(q.x, q.y, `${r.months} mo quiet`, { ...style, anchor: "middle" }));
  }
  return out.join("");
}

