import { describe, expect, it } from "vitest";
import { aggregate, fetchActivity, type WindowData, type WindowEntry } from "../src/github/contributions.js";
import { GitHubError, type GraphQL } from "../src/github/graphql.js";
import { handleMilkyWay } from "../src/handler.js";
import { fixtureDeps } from "./deps.js";

const entry = (nameWithOwner: string, isPrivate: boolean, commits: number): WindowEntry => ({
  repository: {
    id: `R_${nameWithOwner}`,
    nameWithOwner,
    isPrivate,
    owner: { login: nameWithOwner.split("/")[0]! },
    languages: { totalSize: 10, edges: [{ size: 10, node: { name: "Go", color: "#00ADD8" } }] },
  },
  contributions: { totalCount: 1, nodes: [{ occurredAt: "2026-10-01T00:00:00Z", commitCount: commits }] },
});
const page: WindowData = {
  user: {
    contributionsCollection: {
      totalRepositoriesWithContributedCommits: 3,
      commitContributionsByRepository: [entry("mona/open", false, 5), entry("mona/diary-of-secrets", true, 7), entry("acme-corp/payroll-engine", true, 11)],
    },
  },
};
const PRIVATE_NAMES = /diary-of-secrets|payroll-engine|acme-corp/;

/** A fake GitHub for one Subject; `viewer` is the token's owner. */
function github(viewer: string) {
  const asked: string[] = [];
  const gql: GraphQL = async (query, vars: any = {}) => {
    if (query.includes("viewer")) return { viewer: { login: viewer } } as any;
    if (query.includes("repositoryOwner")) return { repositoryOwner: { __typename: "User", login: "mona", contributionsCollection: { contributionYears: [2026] } } } as any;
    asked.push(vars.from);
    return structuredClone(page) as any;
  };
  return { gql, asked };
}
const now = new Date("2026-11-05T00:00:00Z");

describe("private levels", () => {
  it("off counts public Activity only, owned adds the Subject's own private repositories, all adds organisations'", () => {
    const totals = (level: "off" | "owned" | "all") => aggregate([page], { level, login: "mona" }).map((r) => r.total).sort((a, b) => a - b);
    expect(totals("off")).toEqual([5]);
    expect(totals("owned")).toEqual([5, 7]);
    expect(totals("all")).toEqual([5, 7, 11]);
  });

  it("never keeps a private repository's name or a key derived from it", () => {
    const repos = aggregate([page], { level: "all", login: "mona" });
    expect(JSON.stringify(repos)).not.toMatch(PRIVATE_NAMES);
    expect(repos.filter((r) => r.isPrivate).every((r) => r.name === null)).toBe(true);
  });

  it("fetches no private data when the token belongs to someone else", async () => {
    const gh = github("someone-else");
    await expect(fetchActivity(gh.gql, "mona", now, { private: "owned" })).resolves.toEqual({ kind: "private-mismatch", tokenOwner: "someone-else" });
    expect(gh.asked).toEqual([]);
  });

  it("shows the private-mismatch Fallback Card through the endpoint", async () => {
    const res = await handleMilkyWay(new Request("https://card.example/api/milky-way"), fixtureDeps({ config: { username: "mona", private: "owned" }, gql: github("someone-else").gql }));
    expect(await res.text()).toContain("Private Activity needs the Subject");
  });

  it("stores and draws no private names at any level", async () => {
    for (const level of ["off", "owned", "all"] as const) {
      const deps = fixtureDeps({ config: { username: "mona", private: level }, gql: github("mona").gql });
      const svg = await (await handleMilkyWay(new Request("https://card.example/api/milky-way"), deps)).text();
      expect(svg).not.toMatch(PRIVATE_NAMES);
      expect(JSON.stringify([...deps.store.data.values()])).not.toMatch(PRIVATE_NAMES);
      expect(svg).toContain(level === "off" ? "5 commits" : level === "owned" ? "12 commits" : "23 commits");
    }
  });

  it("lowering the level, or changing the token, stops serving stored private data even when the refresh fails", async () => {
    const gh = github("mona");
    const owned = fixtureDeps({ config: { username: "mona", private: "all" }, gql: gh.gql });
    expect(await (await handleMilkyWay(new Request("https://card.example/api/milky-way"), owned)).text()).toContain("23 commits");
    const failing: GraphQL = async () => {
      throw new GitHubError("rate limit", "rate-limited");
    };
    for (const change of [{ config: { username: "mona", private: "off" } }, { config: { username: "mona", private: "owned" } }, { token: "a-new-token" }]) {
      const svg = await (await handleMilkyWay(new Request("https://card.example/api/milky-way"), { ...owned, gql: failing, ...change })).text();
      expect(svg).not.toContain("23 commits");
      expect(svg).toContain("GitHub is busy");
    }
  });
});
