import { buildBandTime } from "../band-time.js";
import { drawBackground, drawBand, drawGrid, FULL_DENSITY } from "./band.js";
import type { RenderOptions } from "./card.js";
import { Ink } from "./ink.js";
import { SUB, TEXT } from "./labels.js";
import { motionCss, stripTiming } from "./motion.js";
import { frame } from "./svg.js";
import { TextWriter } from "./text.js";

/** Why no Milky Way can be drawn. */
export type FallbackReason =
  | { kind: "misconfigured"; detail: string }
  | { kind: "unknown-subject"; login: string }
  | { kind: "organization"; login: string }
  | { kind: "no-activity"; login: string }
  | { kind: "preparing" }
  | { kind: "rate-limited" }
  | { kind: "unreachable" }
  | { kind: "private-mismatch"; login: string; tokenOwner: string };

/** The words on each Fallback Card. */
export function fallbackText(r: FallbackReason): { title: string; detail: string } {
  switch (r.kind) {
    case "misconfigured":
      return { title: "This Card is not configured yet", detail: r.detail };
    case "unknown-subject":
      return { title: "No such GitHub user", detail: `Nobody on GitHub is called ${r.login}; check username in card.config.json` };
    case "organization":
      return { title: "Organizations have no Milky Way", detail: `${r.login} is an organization; the Card maps one person's commits` };
    case "no-activity":
      return { title: "An empty sky, for now", detail: `${r.login} has no commits to map yet` };
    case "preparing":
      return { title: "Charting the Milky Way…", detail: "The first map takes a moment; reload in a minute" };
    case "rate-limited":
      return { title: "GitHub is busy", detail: "GitHub's rate limit was reached; the Card returns shortly" };
    case "unreachable":
      return { title: "GitHub could not be reached", detail: "The Card returns as soon as GitHub answers" };
    case "private-mismatch":
      return { title: "Private Activity needs the Subject's own token", detail: `The token belongs to ${r.tokenOwner}, not ${r.login}; set private to off or use their token` };
  }
}

/**
 * A Fallback Card: the same frame, size and visual language as the Card (background stars, an
 * empty Band in perspective, text as paths), with a title and a line of explanation.
 */
export function renderFallback(reason: FallbackReason, options: RenderOptions, now: Date): string {
  const ink = new Ink(options.theme);
  const tw = new TextWriter(ink);
  let ids = 0;
  const uid = (tag: string) => `${tag}${(ids++).toString(36)}`;
  const t = buildBandTime([], now);
  const { title, detail } = fallbackText(reason);
  const band = drawBand(ink, t, { ...FULL_DENSITY, clouds: 140 }, uid);
  const text =
    tw.draw(18, 32, title, { face: "serif", size: 23, fill: TEXT, maxWidth: 810 }) +
    tw.draw(18, 53, detail, { face: "sans", size: 11, fill: SUB, maxWidth: 810 });
  const svg = frame(
    `${title}. ${detail}`,
    drawBackground(ink, FULL_DENSITY) + `<g opacity=".6">${drawGrid(ink, t)}${band.svg}</g>` + text,
    `<style>${motionCss(options.animate)}${ink.css()}</style><defs>${tw.glyphDefs()}</defs>`,
  );
  return options.animate ? svg : stripTiming(svg);
}
