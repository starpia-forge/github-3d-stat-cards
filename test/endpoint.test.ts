import { describe, expect, it } from "vitest";
import { CARD_CACHE, handleMilkyWay } from "../src/handler.js";
import { fixtureDeps, rec } from "./deps.js";

const request = new Request("https://card.example/api/milky-way");
const deps = fixtureDeps();
const BUDGET = 100_000;

describe("/api/milky-way", () => {
  it("renders the recorded fixture as a cached SVG Card", async () => {
    const res = await handleMilkyWay(request, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(CARD_CACHE);
    const body = await res.text();
    expect(body).toMatch(/^<svg [^>]*width="100%" viewBox="0 0 846 282"/);
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(BUDGET);
    await expect(body).toMatchFileSnapshot("__snapshots__/card.svg");
  });

  it.each(["light", "dark"])("renders the %s theme on its own", async (theme) => {
    const body = await (await handleMilkyWay(new Request(`https://card.example/api/milky-way?theme=${theme}`), deps)).text();
    expect(body).not.toContain("prefers-color-scheme");
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(BUDGET);
    await expect(body).toMatchFileSnapshot(`__snapshots__/card-${theme}.svg`);
  });

  it("escapes the text summary", async () => {
    const body = await (await handleMilkyWay(request, fixtureDeps({ config: { username: rec.login, displayName: "A<b>&\"c" } }))).text();
    expect(body).toContain("<title>A&lt;b&gt;&amp;&quot;c&#39;s Milky Way: since Apr 2024");
    expect(body).toMatch(/aria-label="A&lt;b&gt;&amp;&quot;c&#39;s Milky Way/);
    expect(body).not.toContain("<text");
  });

  it("hides Languages from the legend and the text summary", async () => {
    const shown = await (await handleMilkyWay(request, deps)).text();
    const hidden = await (await handleMilkyWay(request, fixtureDeps({ config: { username: rec.login, hide: ["Go"] } }))).text();
    expect(shown).toMatch(/<title>[^<]*last 12 months: Go /);
    expect(hidden).not.toMatch(/<title>[^<]*Go/);
    expect(hidden).toContain("20 projects");
  });

  it("follows prefers-color-scheme without a theme", async () => {
    const body = await (await handleMilkyWay(request, deps)).text();
    expect(body).toContain("@media (prefers-color-scheme:dark)");
  });

  it.each([
    ["a missing config", fixtureDeps({ config: undefined }), "Card is not configured"],
    ["a config without username", fixtureDeps({ config: { hide: [] } }), "username is required"],
    ["an invalid login", fixtureDeps({ config: { username: "-x-" } }), "not a valid GitHub login"],
    ["an unknown user", fixtureDeps({ gql: async () => ({ repositoryOwner: null }) as any }), "No such GitHub user"],
    ["no token", fixtureDeps({ gql: undefined, token: undefined }), "GITHUB_TOKEN is not set"],
  ])("answers %s with a Fallback Card", async (_case, d, text) => {
    const res = await handleMilkyWay(request, d as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    const body = await res.text();
    expect(body).toMatch(/^<svg [^>]*viewBox="0 0 846 282"/);
    expect(body).toContain(text);
  });
});
