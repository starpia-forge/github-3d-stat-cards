import { describe, expect, it } from "vitest";
import { GitHubError, type GraphQL } from "../src/github/graphql.js";
import { CARD_CACHE, handleMilkyWay, handleRefresh } from "../src/handler.js";
import { storageKey, type Stored } from "../src/store.js";
import { fixtureDeps, rec } from "./deps.js";
import { replay } from "./replay.js";

const request = new Request("https://card.example/api/milky-way?theme=dark");
const HOUR = 3_600_000;
const config = { username: rec.login, displayName: undefined, hide: [], private: "off" as const };

/** A fake GitHub that counts calls and can be switched to fail or hang. */
function github() {
  const real = replay(rec);
  const state = { calls: 0, mode: "ok" as "ok" | "rate-limited" | "hang", release: () => {} };
  const gql: GraphQL = async (q, v) => {
    state.calls++;
    if (state.mode === "rate-limited") throw new GitHubError("rate limit", "rate-limited");
    if (state.mode === "hang") await new Promise<void>((r) => (state.release = r));
    return real(q, v);
  };
  return { gql, state };
}

/** A clock the test moves forward. */
function clock(start = rec.recordedAt) {
  let t = Date.parse(start);
  return { now: () => new Date(t), advance: (ms: number) => void (t += ms) };
}

describe("stored data and background refresh", () => {
  it("fetches inline on the first render, stores it, and then serves stored data without GitHub", async () => {
    const gh = github();
    const deps = fixtureDeps({ gql: gh.gql });
    const first = await handleMilkyWay(request, deps);
    expect(first.headers.get("cache-control")).toBe(CARD_CACHE);
    const callsAfterFirst = gh.state.calls;
    expect(callsAfterFirst).toBeGreaterThan(0);
    gh.state.mode = "rate-limited";
    const second = await handleMilkyWay(request, deps);
    expect(await second.text()).toBe(await first.text());
    expect(gh.state.calls).toBe(callsAfterFirst);
  });

  it("serves data older than 12 h as is and refreshes it in the background", async () => {
    const gh = github();
    const c = clock();
    const deps = fixtureDeps({ gql: gh.gql, now: c.now });
    await handleMilkyWay(request, deps);
    const key = storageKey(config, "t");
    const before = (deps.store.data.get(key) as Stored).storedAt;

    c.advance(11 * HOUR);
    await handleMilkyWay(request, deps);
    expect(deps.background).toHaveLength(0);

    c.advance(2 * HOUR);
    const res = await handleMilkyWay(request, deps);
    expect(res.headers.get("content-type")).toContain("svg");
    expect(deps.background).toHaveLength(1);
    await Promise.all(deps.background);
    expect((deps.store.data.get(key) as Stored).storedAt).not.toBe(before);
  });

  it("keeps serving the last successful data when a refresh fails", async () => {
    const gh = github();
    const c = clock();
    const deps = fixtureDeps({ gql: gh.gql, now: c.now });
    const good = await (await handleMilkyWay(request, deps)).text();
    const key = storageKey(config, "t");
    const kept = structuredClone(deps.store.data.get(key));
    gh.state.mode = "rate-limited";
    c.advance(13 * HOUR);
    expect(await (await handleMilkyWay(request, deps)).text()).toBe(good);
    await Promise.all(deps.background);
    expect(deps.store.data.get(key)).toEqual(kept);
  });

  it("answers a slow first render with a 'preparing' Fallback Card and finishes in the background", async () => {
    const gh = github();
    gh.state.mode = "hang";
    const deps = fixtureDeps({ gql: gh.gql, delay: async () => {} });
    const res = await handleMilkyWay(request, deps);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain("Preparing");
    expect(deps.background).toHaveLength(1);
    gh.state.mode = "ok";
    gh.state.release();
    await Promise.all(deps.background);
    expect(deps.store.data.size).toBe(1);
    expect((await handleMilkyWay(request, deps)).headers.get("cache-control")).toBe(CARD_CACHE);
  });

  it("answers a failed first render with a 'rate-limited' Fallback Card", async () => {
    const gh = github();
    gh.state.mode = "rate-limited";
    const res = await handleMilkyWay(request, fixtureDeps({ gql: gh.gql }));
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain("GitHub is busy");
  });

  it("never serves data stored under another Subject, private level or token, not even as a last resort", async () => {
    const gh = github();
    const deps = fixtureDeps({ gql: gh.gql });
    await handleMilkyWay(request, deps);
    gh.state.mode = "rate-limited";
    for (const other of [
      { config: { username: rec.login }, token: "another-token" },
      { config: { username: rec.login, private: "owned" }, token: "t" },
      { config: { username: "someone-else" }, token: "t" },
    ]) {
      const res = await handleMilkyWay(request, { ...deps, ...other });
      expect(await res.text()).toContain("GitHub is busy");
    }
  });

  it("ignores stored data whose key or shape does not match", async () => {
    const gh = github();
    gh.state.mode = "rate-limited";
    const deps = fixtureDeps({ gql: gh.gql });
    const key = storageKey(config, "t");
    deps.store.data.set(key, { version: 1, key: "milky-way:v1:other:off:x", activity: { repos: [] }, storedAt: rec.recordedAt, complete: true });
    expect(await (await handleMilkyWay(request, deps)).text()).toContain("GitHub is busy");
  });
});

describe("/api/refresh (daily cron)", () => {
  it("requires the cron secret when one is set, then refreshes the stored data", async () => {
    const deps = fixtureDeps();
    const refresh = new Request("https://card.example/api/refresh");
    expect((await handleRefresh(refresh, { ...deps, cronSecret: "s" })).status).toBe(401);
    const ok = await handleRefresh(new Request(refresh, { headers: { authorization: "Bearer s" } }), { ...deps, cronSecret: "s" });
    expect(await ok.json()).toEqual({ refreshed: true, kind: "user" });
    expect(deps.store.data.size).toBe(1);
  });
});
