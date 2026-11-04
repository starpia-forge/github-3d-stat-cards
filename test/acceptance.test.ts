// v1 acceptance: one deterministic Subject through the endpoint, covering every Tier, the labels,
// hide, Private Activity off and owned, static mode, narrow rendering and every Fallback case.
import { describe, expect, it } from "vitest";
import { handleMilkyWay, type Deps } from "../src/handler.js";
import { SIZE_BUDGET } from "../src/render/card.js";
import { unsafeKeyframes } from "../src/render/motion.js";
import { fixtureDeps } from "./deps.js";
import { fakeGitHub, type Day, type RepoMeta } from "./fake-github.js";

const NOW = new Date("2026-11-05T09:00:00Z");
const LOGIN = "mona";

/** `count` commits spread over `months` months from `from`, on local (UTC+9) midnights. */
function spread(repo: string, count: number, from: string, months: number): Day[] {
  const [y, m] = from.split("-").map(Number);
  const days: Day[] = [];
  for (let i = 0; i < count; i++) {
    const month = (m! - 1 + (i % months)) | 0;
    const day = 1 + ((i * 7) % 27);
    days.push({ repo, occurredAt: new Date(Date.UTC(y!, month, day) - 9 * 3_600_000).toISOString(), commitCount: 1 });
  }
  return days;
}
const TS: [string, string, number] = ["TypeScript", "#3178c6", 70];
const CSS: [string, string, number] = ["CSS", "#563d7c", 30];
const GO: [string, string, number] = ["Go", "#00ADD8", 100];
const RUST: [string, string, number] = ["Rust", "#dea584", 100];
const HTML: [string, string, number] = ["HTML", "#e34c26", 100];

const days: Day[] = [
  ...spread("galaxy", 420, "2025-01", 14), // Nebula
  ...spread("orbit", 160, "2026-03", 6), // Planet with rings and a storm
  ...spread("moon", 70, "2024-06", 4), // Planet
  ...spread("comet", 25, "2026-08", 2), // Star
  ...spread("spark", 4, "2023-02", 1), // Starlight, before a Rift
  ...spread("pages", 12, "2026-10", 1), // a Star whose only Language is hidden
  ...spread("diary", 90, "2026-05", 3), // private, owned
  ...spread("payroll", 40, "2026-06", 2), // private, an organization's
];
const meta: Record<string, RepoMeta> = {
  galaxy: { languages: [TS, CSS] },
  orbit: { languages: [GO, TS] },
  moon: { languages: [RUST] },
  comet: { languages: [GO] },
  spark: { languages: [] },
  pages: { languages: [HTML] },
  diary: { isPrivate: true, languages: [RUST] },
  payroll: { isPrivate: true, owner: "acme-corp", languages: [GO] },
};
const subject = (overrides: Partial<Deps> = {}) =>
  fixtureDeps({ config: { username: LOGIN, displayName: "Mona Lisa", hide: ["HTML"] }, gql: fakeGitHub(LOGIN, days, [2023, 2024, 2025, 2026], meta).gql, now: () => NOW, ...overrides });
const get = async (deps: Deps, q = "") => {
  const res = await handleMilkyWay(new Request(`https://card.example/api/milky-way?${q}`), deps);
  return { res, svg: await res.text() };
};

describe("v1 acceptance", () => {
  it.each([
    ["dark", "theme=dark"],
    ["light", "theme=light"],
    ["auto", ""],
    ["static", "theme=dark&animate=false"],
  ])("draws every Tier and label (%s)", async (name, q) => {
    const { res, svg } = await get(subject(), q);
    expect(res.headers.get("cache-control")).toBe("public, max-age=21600, s-maxage=21600");
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(SIZE_BUDGET);
    expect(svg).not.toContain("<text");
    // header, in the summary
    expect(svg).toContain("<title>Mona Lisa&#39;s Milky Way: since Feb 2023 · 691 commits · 6 projects; last 12 months:");
    // every Tier (Nebula wisps, Planet hover, Star spikes or light-mode cross, Starlight halo)
    expect(svg).toMatch(/class="neb[ "]/);
    expect(svg).toMatch(/class="hy a(16|18|20|22|24)"/);
    expect(svg).toMatch(/class="gw[ "]/);
    // the labels (header, legends, year ticks, today, the Rift after 2023, the public Nebula's name) as glyph uses
    expect((svg.match(/<use /g) ?? []).length).toBeGreaterThan(150);
    // narrow labels are in the same SVG
    expect(svg).toContain('<g class="nw">');
    if (name === "static") expect(svg).not.toContain("@keyframes");
    else expect(unsafeKeyframes(svg)).toEqual([]);
    // hide: HTML is gone from the legend, the summary and the colours; the repository stays
    expect(svg).not.toMatch(/<title>[^<]*HTML/);
    expect(svg).not.toContain("#e34c26");
    await expect(svg).toMatchFileSnapshot(`__snapshots__/acceptance-${name}.svg`);
  });

  it("adds owned Private Activity, without names, and never an organization's at owned", async () => {
    const off = (await get(subject(), "theme=dark")).svg;
    const owned = (await get(subject({ config: { username: LOGIN, displayName: "Mona Lisa", hide: ["HTML"], private: "owned" } }), "theme=dark")).svg;
    const all = (await get(subject({ config: { username: LOGIN, displayName: "Mona Lisa", hide: ["HTML"], private: "all" } }), "theme=dark")).svg;
    expect(off).toContain("691 commits · 6 projects");
    expect(owned).toContain("781 commits · 7 projects");
    expect(all).toContain("821 commits · 8 projects");
    for (const svg of [off, owned, all]) expect(svg).not.toMatch(/diary|payroll|acme/);
    await expect(owned).toMatchFileSnapshot("__snapshots__/acceptance-owned.svg");
  });

  it("shows the private-mismatch Fallback Card when the token is someone else's", async () => {
    const { svg } = await get(subject({ config: { username: LOGIN, private: "owned" }, gql: fakeGitHub(LOGIN, days, [2026], meta, "someone-else").gql }));
    expect(svg).toContain("Private Activity needs the Subject");
  });
});
