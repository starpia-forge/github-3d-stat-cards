import { describe, expect, it } from "vitest";
import { fetchActivity } from "../src/github/contributions.js";
import { createGraphQL, GitHubError, type GraphQL } from "../src/github/graphql.js";
import { handleMilkyWay, handleRefresh, RETRY_AFTER_MS } from "../src/handler.js";
import { storageKey, type Stored } from "../src/store.js";
import { fixtureDeps, rec } from "./deps.js";
import { everyDay, fakeGitHub } from "./fake-github.js";
import { replay } from "./replay.js";

const request = new Request("https://card.example/api/milky-way?theme=dark");
const HOUR = 3_600_000;
const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

describe("GitHub client", () => {
  it("fails a response that carries errors, so a partial answer is never stored", async () => {
    const gql = createGraphQL("t", respond(200, { data: { user: null }, errors: [{ type: "FORBIDDEN", message: "Resource protected by organization SAML" }] }));
    await expect(gql("q")).rejects.toMatchObject({ kind: "failed" });
  });

  it("treats NOT_FOUND as an answer, not a failure", async () => {
    const gql = createGraphQL("t", respond(200, { data: { user: null }, errors: [{ type: "NOT_FOUND", message: "no user" }] }));
    await expect(gql("q")).resolves.toEqual({ user: null });
  });

  it("tells a rejected token from a rate limit", async () => {
    await expect(createGraphQL("t", respond(401, "Bad credentials"))("q")).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(createGraphQL("t", respond(403, "Resource not accessible"))("q")).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(createGraphQL("t", respond(403, "", { "x-ratelimit-remaining": "0" }))("q")).rejects.toMatchObject({ kind: "rate-limited" });
    await expect(createGraphQL("t", respond(403, "You have exceeded a secondary rate limit"))("q")).rejects.toMatchObject({ kind: "rate-limited" });
  });

  it("asks GitHub at most four questions at once", async () => {
    const gh = fakeGitHub("mona", [2020, 2021, 2022, 2023, 2024, 2025].flatMap((y) => everyDay("busy", y)), [2020, 2021, 2022, 2023, 2024, 2025]);
    let open = 0;
    let peak = 0;
    const counting: GraphQL = async (q, v) => {
      peak = Math.max(peak, ++open);
      await new Promise((r) => setTimeout(r, 1));
      try {
        return await gh.gql(q, v);
      } finally {
        open--;
      }
    };
    await fetchActivity(counting, "mona", new Date("2026-01-10T00:00:00Z"));
    expect(peak).toBeLessThanOrEqual(4);
    expect(gh.windows.length).toBeGreaterThan(60);
  });
});

describe("refresh hardening", () => {
  it("shows a configuration Fallback Card when GitHub rejects the token", async () => {
    const gql: GraphQL = async () => {
      throw new GitHubError("Bad credentials", "unauthorized");
    };
    expect(await (await handleMilkyWay(request, fixtureDeps({ gql }))).text()).toContain("GitHub rejected GITHUB_TOKEN");
  });

  it("still answers with the Card when storing it fails", async () => {
    const deps = fixtureDeps();
    deps.store.set = async () => {
      throw new Error("cache unavailable");
    };
    const res = await handleMilkyWay(request, deps);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
  });

  it("replaces stored data when a successful refresh finds no Activity", async () => {
    let now = Date.parse(rec.recordedAt);
    const deps = fixtureDeps({ now: () => new Date(now) });
    await handleMilkyWay(request, deps);
    now += 13 * HOUR;
    const empty = fakeGitHub(rec.login, [], [2026]);
    const stale = { ...deps, gql: empty.gql };
    await handleMilkyWay(request, stale);
    await Promise.all(deps.background);
    const key = storageKey({ username: rec.login, displayName: undefined, hide: [], private: "off" }, "t");
    expect((deps.store.data.get(key) as Stored).activity.repos).toEqual([]);
    expect(await (await handleMilkyWay(request, stale)).text()).toContain("An empty sky");
  });

  it("does not retry a failed background refresh on every request, and runs one refresh at a time", async () => {
    let now = Date.parse(rec.recordedAt);
    let calls = 0;
    let failing = false;
    const real = replay(rec);
    const gql: GraphQL = async (q, v) => {
      calls++;
      if (failing) throw new GitHubError("rate limit", "rate-limited");
      return real(q, v);
    };
    const deps = fixtureDeps({ gql, now: () => new Date(now) });
    await handleMilkyWay(request, deps);
    failing = true;
    now += 13 * HOUR;
    const before = calls;
    await Promise.all([handleMilkyWay(request, deps), handleMilkyWay(request, deps)]);
    await Promise.allSettled(deps.background);
    const afterFailure = calls;
    expect(deps.background).toHaveLength(2);
    expect(afterFailure - before).toBe(1); // both requests shared one refresh, which failed on its first question
    await handleMilkyWay(request, deps);
    expect(calls).toBe(afterFailure);
    now += RETRY_AFTER_MS + 1;
    await handleMilkyWay(request, deps);
    await Promise.allSettled(deps.background);
    expect(calls).toBeGreaterThan(afterFailure);
  });

  it("keeps /api/refresh closed unless CRON_SECRET is set", async () => {
    const res = await handleRefresh(new Request("https://card.example/api/refresh"), fixtureDeps());
    expect(res.status).toBe(503);
  });
});
