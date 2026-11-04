import { describe, expect, it } from "vitest";
import { contributionDay, middlePeriod, periodOf } from "../src/activity.js";
import { aggregate, fetchActivity } from "../src/github/contributions.js";
import fixture from "./fixtures/public-activity.json" with { type: "json" };
import { replay, type Recording } from "./replay.js";

const rec = fixture as Recording;
const repo = (name: string, isPrivate: boolean, days: [string, number][], languages: [string, number][] = [["Go", 100]]) => ({
  repository: {
    id: `R_${name}`,
    nameWithOwner: name,
    isPrivate,
    owner: { login: name.split("/")[0]! },
    languages: { totalSize: languages.reduce((a, [, s]) => a + s, 0), edges: languages.map(([n, size]) => ({ size, node: { name: n, color: "#00ADD8" } })) },
  },
  contributions: { totalCount: days.length, nodes: days.map(([occurredAt, commitCount]) => ({ occurredAt, commitCount })) },
});
const page = (...entries: ReturnType<typeof repo>[]) => ({
  user: { contributionsCollection: { totalRepositoriesWithContributedCommits: entries.length, commitContributionsByRepository: entries } },
});

describe("contribution days", () => {
  it.each([
    ["2024-02-29T15:00:00Z", "2024-03"], // local midnight 1 March in UTC+9
    ["2024-03-01T08:00:00Z", "2024-03"], // local midnight 1 March in UTC−8
    ["2023-12-31T15:00:00Z", "2024-01"], // New Year in UTC+9 lands in January
    ["2024-12-31T08:00:00Z", "2024-12"], // New Year's Eve in UTC−8 stays in December
    ["2024-01-01T00:00:00Z", "2024-01"],
  ])("%s is in %s", (at, period) => {
    expect(periodOf(contributionDay(at))).toBe(period);
  });
});

describe("aggregate", () => {
  it("sums days into monthly Periods across yearly windows", () => {
    const repos = aggregate([
      page(repo("me/a", false, [["2023-12-30T15:00:00Z", 2], ["2023-12-31T15:00:00Z", 3]])),
      page(repo("me/a", false, [["2024-01-15T15:00:00Z", 1]]), repo("me/b", false, [["2024-02-01T00:00:00Z", 9]])),
    ]);
    expect(repos.map((r) => [r.name, r.months, r.total])).toEqual([
      ["me/b", { "2024-02": 9 }, 9],
      ["me/a", { "2023-12": 2, "2024-01": 4 }, 6],
    ]);
  });

  it("keeps the Language Mix largest first and derives shares", () => {
    const [r] = aggregate([page(repo("me/a", false, [["2024-01-01T00:00:00Z", 1]], [["TypeScript", 300], ["CSS", 100]]))]);
    expect(r!.languages.map((l) => [l.name, l.share])).toEqual([["TypeScript", 0.75], ["CSS", 0.25]]);
  });

  it("never keeps a private repository's name", () => {
    const [r] = aggregate([page(repo("me/secret-plan", true, [["2024-01-01T00:00:00Z", 1]]))], { level: "owned", login: "me" });
    expect(r!.name).toBeNull();
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("drops repositories without commits", () => {
    expect(aggregate([page(repo("me/a", false, [["2024-01-01T00:00:00Z", 0]]))])).toEqual([]);
  });
});

describe("fetchActivity on the recorded public fixture", () => {
  it("matches every recorded day exactly once", async () => {
    const result = await fetchActivity(replay(rec), rec.login, new Date(rec.recordedAt));
    if (result.kind !== "subject") throw new Error(result.kind);
    // a year that was filled in with monthly windows counts those, not the cut-short yearly window
    const windows = rec.calls.filter((c) => c.data.user);
    const isYear = (c: (typeof windows)[number]) => String(c.variables.from).endsWith("-01-01T00:00:00.000Z") && String(c.variables.to).slice(0, 4) === String(c.variables.from).slice(0, 4) && !String(c.variables.to).startsWith(String(c.variables.from).slice(0, 7));
    const filled = new Set(windows.filter((c) => !isYear(c)).map((c) => String(c.variables.from).slice(0, 4)));
    const used = windows.filter((c) => (isYear(c) ? !filled.has(String(c.variables.from).slice(0, 4)) : true));
    const days = used.flatMap((c) => c.data.user.contributionsCollection.commitContributionsByRepository.flatMap((e: any) => e.contributions.nodes));
    const recorded = days.reduce((a: number, d: any) => a + d.commitCount, 0);
    expect(result.activity.repos.reduce((a, r) => a + r.total, 0)).toBe(recorded);
    for (const r of result.activity.repos) {
      expect(Object.values(r.months).reduce((a, b) => a + b, 0)).toBe(r.total);
      expect(r.name).not.toBeNull();
      expect(middlePeriod(r)).toBeGreaterThan(0);
    }
    expect(result.activity.repos.map((r) => r.name).slice(0, 2)).toEqual(["starpia-forge/momo-shell", "starpia-forge/codex-delegate"]);
  });

  it("reports organisations and unknown logins", async () => {
    const gql = async (_q: string, v: any) => ({ repositoryOwner: v.login === "org" ? { __typename: "Organization", login: "org" } : null }) as any;
    await expect(fetchActivity(gql, "org", new Date())).resolves.toEqual({ kind: "organization", login: "org" });
    await expect(fetchActivity(gql, "nobody", new Date())).resolves.toEqual({ kind: "missing" });
  });
});
