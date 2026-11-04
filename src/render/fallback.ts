import { esc, frame, H, W } from "./svg.js";

/** A minimal Fallback Card: plain text in the Card frame. */
export function renderFallback(title: string, detail: string): string {
  return frame(
    `${title}. ${detail}`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="#8b949e" stroke-opacity=".5"/>` +
      `<g font-family="Inter,system-ui,sans-serif" fill="#8b949e" text-anchor="middle">` +
      `<text x="${W / 2}" y="${H / 2 - 6}" font-size="20">${esc(title)}</text>` +
      `<text x="${W / 2}" y="${H / 2 + 20}" font-size="13">${esc(detail)}</text></g>`,
  );
}
