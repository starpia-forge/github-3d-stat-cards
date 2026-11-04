import { describe, expect, it } from "vitest";
import { Ink, th } from "../src/render/ink.js";

describe("Ink", () => {
  it("resolves themed values with a forced theme", () => {
    expect(new Ink("dark").el("circle", { r: 1, fill: th("#fff", "#000") })).toBe('<circle r="1" fill="#000"/>');
    expect(new Ink("light").el("circle", { fill: "red" }, undefined, "dark")).toBe("");
  });

  it("turns themed values into classes in auto mode", () => {
    const ink = new Ink("auto");
    const a = ink.el("path", { class: "tw", fill: th("#fff", "#000"), stroke: "red" });
    const b = ink.el("path", { fill: th("#fff", "#000") }, undefined, "light");
    expect(a).toBe('<path stroke="red" class="tw k0"/>');
    expect(b).toBe('<path class="k0 oL"/>');
    expect(ink.css()).toBe(".oD{display:none}.k0{fill:#fff}@media (prefers-color-scheme:dark){.oL{display:none}.oD{display:inline}.k0{fill:#000}}");
  });

  it("refuses to theme attributes CSS cannot set", () => {
    expect(() => new Ink("auto").el("circle", { r: th(1, 2) })).toThrow("r cannot be themed");
  });
});
