import { describe, expect, it } from "vitest";
import { middlePeriod, periodIndex, type RepoActivity } from "../src/activity.js";
import { buildTimeline, RIFT_UNITS } from "../src/timeline.js";
import { TIERS, tierOf } from "../src/tiers.js";

const repo = (months: Record<string, number>): RepoActivity => ({
  key: Object.keys(months).join(),
  name: null,
  isPrivate: false,
  months,
  total: Object.values(months).reduce((a, b) => a + b, 0),
  languages: [],
});
const at = (iso: string) => new Date(iso);
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("buildTimeline", () => {
  it("runs from the first Activity to today", () => {
    const t = buildTimeline([repo({ "2024-01": 1 })], at("2024-03-16T00:00:00Z"));
    expect(t.start).toBe(periodIndex("2024-01"));
    close(t.end, periodIndex("2024-03") + 15 / 31);
    close(t.pos(t.start), 0);
    close(t.pos(t.end), 1);
  });

  it("blends 70% calendar time with 30% cumulative Activity", () => {
    // Two full months, all commits in the first: halfway through calendar time, all of the Activity.
    const t = buildTimeline([repo({ "2024-01": 10 })], at("2024-03-01T00:00:00Z"));
    close(t.pos(periodIndex("2024-02")), 0.7 * 0.5 + 0.3 * 1);
    close(t.pos(periodIndex("2024-01") + 0.5), 0.7 * 0.25 + 0.3 * 0.5);
  });

  it("is monotonic", () => {
    const t = buildTimeline([repo({ "2023-01": 5, "2023-02": 1, "2024-06": 40 })], at("2024-07-10T00:00:00Z"));
    let last = -1;
    for (let i = t.start; i <= t.end; i += 0.25) {
      const p = t.pos(i);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it("turns more than three quiet months into a Rift of 1.4 month-units", () => {
    const t = buildTimeline([repo({ "2023-01": 2, "2023-08": 2 })], at("2023-09-01T00:00:00Z"));
    expect(t.rifts).toEqual([{ from: periodIndex("2023-02"), to: periodIndex("2023-08"), months: 6 }]);
    // Units: Jan 1 + Rift 1.4 + Aug 1 = 3.4. The Rift's calendar share is 1.4 / 3.4.
    const inRift = t.pos(periodIndex("2023-08")) - t.pos(periodIndex("2023-02"));
    close(inRift, 0.7 * (RIFT_UNITS / 3.4));
  });

  it("keeps a quiet run of exactly three months at full width", () => {
    const t = buildTimeline([repo({ "2023-01": 2, "2023-05": 2 })], at("2023-06-01T00:00:00Z"));
    expect(t.rifts).toEqual([]);
  });

  it("draws the current partial month at its daily rate", () => {
    const t = buildTimeline([repo({ "2024-04": 30, "2024-05": 10 })], at("2024-05-11T00:00:00Z"));
    const may = t.months.find((m) => m.period === "2024-05")!;
    expect(may.commits).toBe(10);
    close(may.rate, (10 / 10) * 31);
    expect(t.months.find((m) => m.period === "2024-04")!.rate).toBe(30);
  });

  it("handles a Subject whose only Activity is today", () => {
    const t = buildTimeline([repo({ "2024-05": 3 })], at("2024-05-01T06:00:00Z"));
    expect(t.pos(t.start)).toBe(0);
    expect(Number.isFinite(t.pos(t.start + 0.5))).toBe(true);
  });
});

describe("middlePeriod", () => {
  it("is the commit-weighted middle of the Activity", () => {
    close(middlePeriod(repo({ "2024-01": 1, "2024-03": 3 })), periodIndex("2024-01") + 0.5 + 1.5);
  });
});

describe("tierOf", () => {
  it.each([
    [1, "starlight"],
    [9, "starlight"],
    [10, "star"],
    [49, "star"],
    [50, "planet"],
    [199, "planet"],
    [200, "nebula"],
    [5000, "nebula"],
  ])("%i commits is %s", (c, tier) => expect(tierOf(c)).toBe(tier));

  it("sizes grow with the Tier", () => {
    const sizes = (["starlight", "star", "planet", "nebula"] as const).map((t) => TIERS[t].size);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });
});
