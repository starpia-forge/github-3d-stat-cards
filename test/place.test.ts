import { describe, expect, it } from "vitest";
import { middlePeriod, type RepoActivity } from "../src/activity.js";
import { overlaps, placeBodies, Y_MAX, Y_MIN } from "../src/render/place.js";
import { bandY, flatX } from "../src/render/scene.js";
import { buildTimeline } from "../src/timeline.js";

const now = new Date("2025-06-15T00:00:00Z");
const repo = (i: number, months: Record<string, number>): RepoActivity => ({
  key: (i * 2654435761).toString(16).padStart(16, "0").slice(-16),
  name: null,
  isPrivate: false,
  months,
  total: Object.values(months).reduce((a, b) => a + b, 0),
  languages: [],
});
// 12 Stars crowded into the same two months, plus Starlight and Planets around them
const crowd = [
  ...Array.from({ length: 12 }, (_, i) => repo(i, { "2025-03": 10 + i, "2025-04": 5 })),
  ...Array.from({ length: 30 }, (_, i) => repo(100 + i, { [`2024-${String((i % 12) + 1).padStart(2, "0")}`]: 1 + (i % 8) })),
  ...Array.from({ length: 4 }, (_, i) => repo(200 + i, { "2024-08": 60 + i * 20 })),
];
const t = buildTimeline(crowd, now);

describe("placeBodies", () => {
  it("is deterministic", () => {
    const a = placeBodies(crowd, t).map((b) => [b.x, b.y]);
    const b = placeBodies([...crowd].reverse(), t)
      .sort((p, q) => crowd.indexOf(p.repo) - crowd.indexOf(q.repo))
      .map((p) => [p.x, p.y]);
    expect(b).toEqual(a);
  });

  it("leaves no overlapping Stars or Planets on screen and keeps them inside the canvas", () => {
    const placed = placeBodies(crowd, t);
    expect(overlaps(placed)).toEqual([]);
    for (const b of placed.filter((p) => p.tier !== "starlight")) {
      expect(b.y).toBeGreaterThanOrEqual(Y_MIN);
      expect(b.y).toBeLessThanOrEqual(Y_MAX);
    }
  });

  it("puts x at the commit-weighted middle month", () => {
    const lone = repo(9, { "2024-01": 1, "2024-03": 3 });
    const tl = buildTimeline([lone], now);
    const [b] = placeBodies([lone], tl);
    expect(b!.fx).toBeCloseTo(flatX(tl, middlePeriod(lone)), 6);
  });

  it("keeps larger Tiers nearer the centre of the Band", () => {
    const month = (i: number) => `${2020 + Math.floor(i / 12) % 5}-${String((i % 12) + 1).padStart(2, "0")}`;
    const many = Array.from({ length: 300 }, (_, i) => repo(1000 + i, { [month(i)]: i % 30 ? 3 : 60 }));
    const placed = placeBodies(many, buildTimeline(many, now));
    const spread = (tier: string) => {
      const offs = placed.filter((b) => b.tier === tier).map((b) => Math.abs(b.fy - bandY(b.fx)));
      return offs.reduce((a, b) => a + b, 0) / offs.length;
    };
    expect(spread("planet")).toBeLessThan(spread("starlight"));
  });
});
