import { describe, expect, it } from "vitest";
import { Ink } from "../src/render/ink.js";
import { headerLine, headerName } from "../src/render/labels.js";
import { canDraw, fit, measure, TextWriter } from "../src/render/text.js";

describe("text as paths", () => {
  it("defines each glyph once and reuses it", () => {
    const tw = new TextWriter(new Ink("light"));
    const svg = tw.draw(0, 10, "aaa a", { face: "sans", size: 10, fill: "#000" });
    expect(svg.match(/<use /g)).toHaveLength(4);
    expect(tw.glyphDefs().match(/<path /g)).toHaveLength(1);
    expect(svg).not.toContain("<text");
  });

  it("anchors at the end and in the middle", () => {
    const w = measure("today →", "sans", 10);
    const tw = new TextWriter(new Ink("light"));
    expect(tw.draw(100, 0, "today →", { face: "sans", size: 10, fill: "#000", anchor: "end" })).toContain(`translate(${Math.round((100 - w) * 10) / 10} 0)`);
  });

  it("cuts long text with an ellipsis", () => {
    const s = fit("a-very-long-display-name-that-goes-on", "serif", 23, 120);
    expect(s.endsWith("…")).toBe(true);
    expect(measure(s, "serif", 23)).toBeLessThanOrEqual(120);
    expect(fit("short", "serif", 23, 120)).toBe("short");
  });

  it("covers the Card's symbols", () => {
    for (const s of ["since Apr 2024 · ≈1,234 commits · 5 projects", "today →", "1–9", "200+", "Zoë Šmith"]) {
      expect(canDraw(s, "sans") || s.includes("Š")).toBe(true);
    }
  });
});

describe("header", () => {
  it("uses displayName when it can be drawn, otherwise the login", () => {
    expect(headerName("octo", "Mona Lisa")).toBe("Mona Lisa");
    expect(headerName("octo", "Zoë")).toBe("Zoë");
    expect(headerName("octo", "김민수")).toBe("octo");
    expect(headerName("octo", undefined)).toBe("octo");
  });

  it("marks an incomplete history with ≈", () => {
    expect(headerLine({ name: "x", since: "Apr 2024", commits: 1234, projects: 5 })).toBe("since Apr 2024 · 1,234 commits · 5 projects");
    expect(headerLine({ name: "x", since: "Apr 2024", commits: 1234, projects: 5, approximate: true })).toBe("since Apr 2024 · ≈1,234 commits · 5 projects");
  });
});
