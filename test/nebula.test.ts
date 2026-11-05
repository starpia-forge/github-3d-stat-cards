import { describe, expect, it } from "vitest";
import { renderCard } from "../src/render/card.js";
import { nebulaCollisions, nebulaSize, placeBodies } from "../src/render/place.js";
import { bandY } from "../src/render/scene.js";
import { buildBandTime } from "../src/band-time.js";
import { synthetic } from "./synthetic.js";

const now = "2026-11-05T00:00:00Z";
const config = { username: "synthetic", displayName: undefined, hide: [], private: "off" as const };

describe("Nebulae", () => {
  it("put the largest on the centre line and keep eight crowded ones distinct and apart", () => {
    const a = synthetic({
      seed: 5,
      now,
      repos: Array.from({ length: 8 }, (_, i) => ({ total: 900 - i * 80, from: "2026-03", months: 4 })),
    });
    const t = buildBandTime(a.repos, new Date(now));
    const nebs = placeBodies(a.repos, t).filter((b) => b.tier === "nebula");
    expect(nebs).toHaveLength(8);
    expect(nebulaCollisions(nebs)).toEqual([]);
    const largest = nebs.find((b) => b.repo.total === 900)!;
    expect(largest.fy).toBeCloseTo(bandY(largest.fx), 6);
    expect(new Set(nebs.map((b) => `${Math.round(b.x)},${Math.round(b.y)}`)).size).toBe(8);
  });

  it("stretch with the active span, with a minimum width", () => {
    const a = synthetic({ seed: 1, now, repos: [{ total: 3000, from: "2024-01", months: 30 }, { total: 200, from: "2025-03", months: 1 }] });
    const t = buildBandTime(a.repos, new Date(now));
    const [long, short] = a.repos.map((r) => nebulaSize(r, t));
    expect(long!.w).toBeGreaterThan(short!.w);
    expect(short!.w).toBe(58);
  });

  it("label public Nebulae and never draw or describe private repository names", () => {
    const a = synthetic({
      seed: 2,
      now,
      repos: [
        { total: 400, from: "2026-01", months: 6, name: "synthetic/open-galaxy" },
        { total: 350, from: "2026-02", months: 6, name: "synthetic/secret-project", isPrivate: true },
        { total: 30, from: "2026-04", months: 2, name: "synthetic/hidden-star", isPrivate: true },
      ],
    });
    expect(JSON.stringify(a)).not.toContain("secret-project");
    for (const theme of ["light", "dark", "auto"] as const) {
      const svg = renderCard(a, config, { theme, animate: true });
      expect(svg).not.toMatch(/secret|hidden-star/);
      expect(svg).not.toContain("<text");
    }
    // the public label is drawn as glyph paths: as many <use> as non-space characters
    const svg = renderCard(a, config, { theme: "dark", animate: true });
    expect(svg).toMatch(/<g transform="translate\([^)]*\) scale\(0\.4167\)" fill="#dfe6ee" fill-opacity="0\.85">(<use [^>]*>){11}<\/g>/);
  });
});
