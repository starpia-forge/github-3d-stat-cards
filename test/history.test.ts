import { describe, expect, it } from "vitest";
import { fetchActivity, monthlyWindows } from "../src/github/contributions.js";
import { handleMilkyWay } from "../src/handler.js";
import { storageKey, type Stored } from "../src/store.js";
import { fixtureDeps } from "./deps.js";
import { everyDay, fakeGitHub, type Day } from "./fake-github.js";

const now = new Date("2026-11-05T12:00:00Z");
const sum = (days: Day[]) => days.reduce((a, d) => a + d.commitCount, 0);
const total = (r: Awaited<ReturnType<typeof fetchActivity>>) => (r.kind === "user" ? r.activity.repos.reduce((a, x) => a + x.total, 0) : NaN);

describe("complete histories", () => {
  it("fills in a year with monthly windows when a repository has more than 100 active days", async () => {
    const days = [...everyDay("busy", 2025, 2), { repo: "quiet", occurredAt: "2025-06-01T00:00:00Z", commitCount: 3 }];
    const gh = fakeGitHub("mona", days, [2025]);
    const r = await fetchActivity(gh.gql, "mona", now);
    expect(total(r)).toBe(sum(days));
    expect(r.kind === "user" && r.activity.complete).toBe(true);
    expect(gh.windows).toHaveLength(1 + 12);
  });

  it("counts each day once across window boundaries, including local-midnight timestamps", async () => {
    const edge: Day[] = [
      { repo: "a", occurredAt: "2025-01-31T15:00:00Z", commitCount: 4 }, // 1 Feb in UTC+9, inside the January window
      { repo: "a", occurredAt: "2025-01-31T08:00:00Z", commitCount: 1 }, // 31 Jan in UTC−8
      { repo: "a", occurredAt: "2025-02-01T00:00:00Z", commitCount: 2 },
      { repo: "a", occurredAt: "2025-12-31T15:00:00Z", commitCount: 5 }, // New Year in UTC+9, in the December window
    ];
    const days = [...everyDay("busy", 2025), ...edge];
    const gh = fakeGitHub("mona", days, [2025]);
    const r = await fetchActivity(gh.gql, "mona", now);
    expect(total(r)).toBe(sum(days));
    const a = r.kind === "user" ? r.activity.repos.find((x) => x.name === "mona/a")! : undefined;
    expect(a!.months).toEqual({ "2025-01": 1, "2025-02": 6, "2026-01": 5 });
  });

  it("detects more than 100 repositories in a year and retries with monthly windows", async () => {
    const days: Day[] = Array.from({ length: 150 }, (_, i) => ({ repo: `r${i}`, occurredAt: `2025-${String((i % 12) + 1).padStart(2, "0")}-10T00:00:00Z`, commitCount: 1 + (i % 5) }));
    const gh = fakeGitHub("mona", days, [2025]);
    const r = await fetchActivity(gh.gql, "mona", now);
    expect(r.kind === "user" && r.activity.repos.length).toBe(150);
    expect(r.kind === "user" && r.activity.complete).toBe(true);
  });

  it("marks the history incomplete when a month still has more than 100 repositories", async () => {
    const days: Day[] = Array.from({ length: 130 }, (_, i) => ({ repo: `r${i}`, occurredAt: "2025-03-10T00:00:00Z", commitCount: 1 }));
    const r = await fetchActivity(fakeGitHub("mona", days, [2025]).gql, "mona", now);
    expect(r.kind === "user" && r.activity.complete).toBe(false);
    expect(total(r)).toBe(100);
  });

  it("logs the GraphQL cost of each refresh", async () => {
    const lines: string[] = [];
    await fetchActivity(fakeGitHub("mona", everyDay("busy", 2025), [2024, 2025]).gql, "mona", now, { log: (l) => lines.push(l) });
    expect(lines).toEqual(["GitHub GraphQL: 15 queries, cost 14 for mona"]);
  });

  it("monthly windows stop at today and never overlap", () => {
    const w = monthlyWindows(2026, now);
    expect(w).toHaveLength(11);
    expect(w.at(-1)!.to).toBe(now.toISOString());
    for (let i = 1; i < w.length; i++) expect(Date.parse(w[i]!.from)).toBe(Date.parse(w[i - 1]!.to) + 1000);
  });
});

describe("incomplete data on the Card", () => {
  const crowded: Day[] = Array.from({ length: 130 }, (_, i) => ({ repo: `r${i}`, occurredAt: "2026-03-10T00:00:00Z", commitCount: 1 }));
  const config = { username: "mona" };

  it("shows ≈ before the commit count", async () => {
    const svg = await (await handleMilkyWay(new Request("https://card.example/api/milky-way"), fixtureDeps({ config, gql: fakeGitHub("mona", crowded, [2026]).gql, now: () => now }))).text();
    expect(svg).toContain("· ≈100 commits ·");
  });

  it("never replaces complete stored data with an incomplete refresh", async () => {
    const deps = fixtureDeps({ config, gql: fakeGitHub("mona", crowded.slice(0, 50), [2026]).gql, now: () => now });
    await handleMilkyWay(new Request("https://card.example/api/milky-way"), deps);
    const key = storageKey({ username: "mona", displayName: undefined, hide: [], private: "off" }, "t");
    const before = deps.store.data.get(key) as Stored;
    expect(before.complete).toBe(true);
    const later = new Date(now.getTime() + 13 * 3_600_000);
    const next = { ...deps, gql: fakeGitHub("mona", crowded, [2026]).gql, now: () => later };
    await handleMilkyWay(new Request("https://card.example/api/milky-way"), next);
    await Promise.all(deps.background);
    const after = deps.store.data.get(key) as Stored;
    expect(after.complete).toBe(true);
    expect(after.activity).toEqual(before.activity);
    expect(after.storedAt).toBe(later.toISOString());
  });
});
