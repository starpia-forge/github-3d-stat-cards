import { describe, expect, it } from "vitest";
import { GitHubError, type GraphQL } from "../src/github/graphql.js";
import { handleMilkyWay, type Deps } from "../src/handler.js";
import { fixtureDeps } from "./deps.js";

const owner = (typename: string | null) =>
  (async (q: string) => {
    if (q.includes("viewer")) return { viewer: { login: "someone-else" } };
    if (q.includes("repositoryOwner")) return { repositoryOwner: typename && { __typename: typename, login: "mona", contributionsCollection: { contributionYears: [] } } };
    return { user: null };
  }) as GraphQL;
const failing = (kind: "rate-limited" | "failed"): GraphQL => async () => {
  throw new GitHubError("nope", kind);
};
const hanging: GraphQL = () => new Promise(() => {});

const CASES: [string, Partial<Deps>, string][] = [
  ["misconfigured", { config: { private: "off" } }, "This Card is not configured yet"],
  ["no-token", { token: undefined, gql: undefined }, "GITHUB_TOKEN is not set"],
  ["unknown-subject", { config: { username: "mona" }, gql: owner(null) }, "No such GitHub user"],
  ["organization", { config: { username: "mona" }, gql: owner("Organization") }, "Organizations have no Milky Way"],
  ["no-activity", { config: { username: "mona" }, gql: owner("User") }, "An empty sky, for now"],
  ["preparing", { gql: hanging, delay: async () => {} }, "Charting the Milky Way"],
  ["rate-limited", { gql: failing("rate-limited") }, "GitHub is busy"],
  ["unreachable", { gql: failing("failed") }, "GitHub could not be reached"],
  ["private-mismatch", { config: { username: "mona", private: "owned" }, gql: owner("User") }, "Private Activity needs the Subject"],
];

describe("Fallback Cards", () => {
  it.each(CASES)("%s is reachable through the endpoint in both themes", async (name, overrides, title) => {
    for (const theme of ["dark", "light"] as const) {
      const res = await handleMilkyWay(new Request(`https://card.example/api/milky-way?theme=${theme}`), fixtureDeps(overrides));
      expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
      expect(res.headers.get("cache-control")).toBe("no-store");
      const svg = await res.text();
      expect(svg).toMatch(/^<svg [^>]*width="100%" viewBox="0 0 846 282"/);
      expect(svg).toMatch(new RegExp(`<title>[^<]*${title.replace(/'/g, "&#39;")}`));
      expect(svg).not.toContain("<text");
      expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(100_000);
      if (theme === "dark") await expect(svg).toMatchFileSnapshot(`__snapshots__/fallback-${name}.svg`);
    }
  });
});
