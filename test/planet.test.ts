import { describe, expect, it } from "vitest";
import { buildLanguages } from "../src/languages.js";
import type { DrawContext } from "../src/render/bodies.js";
import { Ink } from "../src/render/ink.js";
import { drawOrder, overlaps, placeBodies, planetRadius } from "../src/render/place.js";
import { drawPlanet, HOVER, hoverAmplitude, planetShape } from "../src/render/planet.js";
import { buildBandTime } from "../src/band-time.js";
import { synthetic } from "./synthetic.js";

const now = "2026-11-05T00:00:00Z";
const activity = synthetic({
  seed: 3,
  now,
  repos: [
    { total: 199, from: "2026-07", months: 3 },
    { total: 150, from: "2026-06", months: 4 },
    { total: 120, from: "2026-05", months: 3 },
    { total: 110, from: "2026-07", months: 3 },
    { total: 80, from: "2026-08", months: 2 },
    { total: 55, from: "2026-08", months: 2 },
    { total: 30, from: "2026-07", months: 2 },
    { total: 20, from: "2026-08", months: 2 },
  ],
});
const t = buildBandTime(activity.repos, new Date(now));
const placed = placeBodies(activity.repos, t);
const ctxFor = (mode: "light" | "dark") => {
  let i = 0;
  const ctx: DrawContext = { ink: new Ink(mode), langs: buildLanguages(activity.repos, [], new Date(now)), uid: (tag) => `${tag}${i++}`, shared: (k) => k };
  return ctx;
};
const planet = (total: number) => placed.find((b) => b.repo.total === total)!;

describe("Planets", () => {
  it("grow with commits", () => {
    expect(planetRadius(50)).toBe(6);
    expect(planetRadius(199)).toBeGreaterThan(planetRadius(100));
    expect(planetRadius(199)).toBeLessThanOrEqual(12);
  });

  it("have rings at 120+ commits and a storm at 100+", () => {
    const ringed = drawPlanet(planet(150), ctxFor("dark"));
    const plain = drawPlanet(planet(110), ctxFor("dark"));
    const small = drawPlanet(planet(55), ctxFor("dark"));
    expect(ringed).toContain("clip-path=\"url(#p0b)\""); // back half of the rings
    expect(plain).not.toMatch(/url\(#p\d+b\)/);
    expect((plain.match(/<ellipse/g) ?? []).length).toBe(1); // the storm
    expect(small).not.toContain("<ellipse");
  });

  it("hatch the night side in light mode only and glow in dark mode only", () => {
    expect(drawPlanet(planet(80), ctxFor("light"))).toMatch(/stroke-opacity="\.38"/);
    expect(drawPlanet(planet(80), ctxFor("dark"))).not.toMatch(/stroke-opacity="\.38"/);
    expect(drawPlanet(planet(80), ctxFor("dark"))).toContain("halo");
  });

  it("hover by an amplitude that grows with size, from 1.6 to 2.4 px", () => {
    expect([2, 3, 7.5, 12, 20].map(hoverAmplitude)).toEqual([1.6, 1.6, 2, 2.4, 2.4]);
  });

  it("hover only by translate, wrapped around the placement", () => {
    expect(drawPlanet(planet(80), ctxFor("dark"))).toMatch(/^<g class="hy a(16|18|20|22|24)"[^>]*><g class="hx"[^>]*><g transform="translate\(/);
  });

  it("keep their rings and hover clearance free of other solid Bodies on screen", () => {
    expect(overlaps(placed)).toEqual([]);
    const ringed = planet(199);
    const shape = planetShape(ringed.seed, 199, ringed.r * ringed.k);
    expect(ringed.halfW).toBeCloseTo(shape.halfW);
    expect(shape.halfW).toBeGreaterThan(shape.r * 2 + HOVER.x);
    expect(shape.halfH).toBeGreaterThanOrEqual(shape.r + HOVER.y.min);
  });

  it("draw larger Bodies behind smaller ones", () => {
    const solid = drawOrder(placed).filter((b) => b.tier === "planet" || b.tier === "star");
    const areas = solid.map((b) => b.halfW * b.halfH);
    expect([...areas].sort((a, b) => b - a)).toEqual(areas);
  });
});
