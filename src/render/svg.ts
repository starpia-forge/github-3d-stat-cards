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

/** Joins numbers with the fewest separators SVG path syntax allows. */
export function joinNumbers(vals: string[]): string {
  let s = "";
  let prev = "";
  for (const v of vals) {
    const glue = !prev || v.startsWith("-") || (v.startsWith(".") && prev.includes(".")) ? "" : " ";
    s += glue + v;
    prev = v;
  }
  return s;
}

/** A number for path data: like `n`, without a leading zero. */
const pn = (v: number): string => n(v).replace(/^(-?)0\./, "$1.");

/**
 * A polyline as compact path data: an absolute start, then relative line segments taken between
 * rounded points (so rounding never drifts). `close` ends it with `z`.
 */
export function poly(points: { x: number; y: number }[] | [number, number][], close = false): string {
  const pts = (points as ({ x: number; y: number } | [number, number])[]).map((p) => (Array.isArray(p) ? p : [p.x, p.y]) as [number, number]);
  if (!pts.length) return "";
  const r = (v: number) => Math.round(v * 10) / 10;
  let [px, py] = [r(pts[0]![0]), r(pts[0]![1])];
  const rel: string[] = [];
  for (const [x, y] of pts.slice(1)) {
    const [rx, ry] = [r(x), r(y)];
    rel.push(pn(rx - px), pn(ry - py));
    [px, py] = [rx, ry];
  }
  return `M${joinNumbers([pn(r(pts[0]![0])), pn(r(pts[0]![1]))])}${rel.length ? "l" + joinNumbers(rel) : ""}${close ? "z" : ""}`;
}
