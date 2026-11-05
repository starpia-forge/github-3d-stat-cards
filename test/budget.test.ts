import { describe, expect, it } from "vitest";
import { LADDER, renderCard, renderWith, SIZE_BUDGET, visibleBodies } from "../src/render/card.js";
import { heavy, synthetic } from "./synthetic.js";

const config = { username: "synthetic", displayName: undefined, hide: [], private: "off" as const };
const bytes = (s: string) => Buffer.byteLength(s);

describe("size budget under heavy load", () => {
  const load = heavy(400);

  it.each(["light", "dark", "auto"] as const)("keeps a 400-repository, 15-year Subject at or under 100 KB (%s, with text, motion and narrow labels)", (theme) => {
    const svg = renderCard(load, config, { theme, animate: true });
    expect(bytes(svg)).toBeLessThanOrEqual(SIZE_BUDGET);
    expect(svg).toContain("@keyframes");
    expect(svg).toContain('<g class="nw">');
    // every repository still counts in the totals
    expect(svg).toContain(`${load.repos.reduce((a, r) => a + r.total, 0).toLocaleString("en-US")} commits · 400 projects`);
  });

  it("reduces only when needed", () => {
    const small = synthetic({ seed: 1, now: "2026-11-05T00:00:00Z", repos: [{ total: 30, from: "2026-01", months: 3 }, { total: 300, from: "2025-06", months: 8 }] });
    const options = { theme: "dark" as const, animate: true };
    expect(renderCard(small, config, options)).toBe(renderWith(small, config, options, { ...LADDER[0]!, cap: small.repos.length }));
  });

  it("follows the fixed order: star clouds, then background stars, then Planet sub-bands, then the Body cap", () => {
    expect(LADDER.map((s) => s.density.clouds)).toEqual([380, 190, 60, 60, 60, 60]);
    expect(LADDER.map((s) => s.density.background.dark)).toEqual([130, 130, 130, 60, 24, 24]);
    expect(LADDER.map((s) => s.subBands)).toEqual([true, true, true, true, true, false]);
  });

  it("melts the Bodies with the fewest commits first", () => {
    const kept = visibleBodies(load.repos, 50);
    const minKept = Math.min(...kept.map((r) => r.total));
    expect(load.repos.filter((r) => !kept.includes(r)).every((r) => r.total <= minKept)).toBe(true);
  });

  it("keeps the legend computed from every repository", () => {
    const capped = renderWith(load, config, { theme: "dark", animate: true }, { ...LADDER[LADDER.length - 1]!, cap: 3 });
    const full = renderWith(load, config, { theme: "dark", animate: true }, { ...LADDER[0]!, cap: load.repos.length });
    const title = (s: string) => s.match(/<title>(.*?)<\/title>/)![1];
    expect(title(capped)).toBe(title(full));
  });
});
