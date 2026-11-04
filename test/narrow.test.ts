import { describe, expect, it } from "vitest";
import { handleMilkyWay } from "../src/handler.js";
import { NARROW_MAX_WIDTH } from "../src/render/labels.js";
import { fixtureDeps } from "./deps.js";

const card = async (q = "") => (await handleMilkyWay(new Request(`https://card.example/api/milky-way?${q}`), fixtureDeps())).text();

describe("narrow rendering", () => {
  it("is one SVG whose width media query swaps the wide labels for fewer, larger ones", async () => {
    const svg = await card("theme=dark");
    expect(svg).toContain(`@media (max-width:${NARROW_MAX_WIDTH}px){.wd{display:none}.nw{display:inline}`);
    const narrow = svg.match(/<g class="nw">(.*?)<\/g><\/svg>$/s)?.[1] ?? "";
    // header (2 runs) plus three Languages (name and share each)
    expect(narrow.match(/<g transform="translate/g)).toHaveLength(2 + 3 * 2);
    expect(narrow.match(/<circle /g)).toHaveLength(3);
    expect(svg).toMatch(/<g class="sc">.*<\/g><g class="wd">/s);
  });

  it("stays within the size budget with the narrow labels included", async () => {
    for (const q of ["", "theme=light", "theme=dark"]) expect(Buffer.byteLength(await card(q))).toBeLessThanOrEqual(100_000);
  });
});
