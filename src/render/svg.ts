/** Small helpers for writing SVG by hand. */
export const W = 846;
export const H = 282;

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);

/** Rounds to at most `d` decimals and drops trailing zeros, keeping the SVG small and deterministic. */
export const n = (v: number, d = 1): string => {
  const s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  const t = s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  return t === "-0" ? "0" : t;
};

/** The Card's outer frame: an 846×282 viewBox that scales to the README column. */
export function frame(label: string, body: string, head = ""): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">` +
    `<title>${esc(label)}</title>${head}${body}</svg>`
  );
}
