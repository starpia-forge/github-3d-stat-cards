import { describe, expect, it } from "vitest";
import { handleMilkyWay } from "../src/handler.js";
import { motionCss, unsafeKeyframes } from "../src/render/motion.js";
import { fixtureDeps } from "./deps.js";

const card = async (q: string) => (await handleMilkyWay(new Request(`https://card.example/api/milky-way?${q}`), fixtureDeps())).text();

describe("motion", () => {
  it("animates only opacity and pure translate", () => {
    expect(unsafeKeyframes(motionCss(true))).toEqual([]);
    expect(unsafeKeyframes("@keyframes x{0%{transform:scale(2)}100%{transform:rotate(3deg)}}")).toEqual(["transform:scale(2)", "transform:rotate(3deg)"]);
    expect(unsafeKeyframes("@keyframes y{0%{transform:translateY(2px) scale(1)}}")).toHaveLength(1);
  });

  it("keeps every amplitude and period within the spec", () => {
    const css = motionCss(true);
    expect(css).toContain("translateY(2.4px)");
    expect(css).toContain("translateX(.9px)");
    expect(css).toMatch(/\.tw\{animation:tw 8s/);
    expect(css).toMatch(/\.neb\{animation:br 11s/);
  });

  it("gives each Body its own glow and hover period within 5–11 s, 5.5–9 s and 8–13 s", async () => {
    const svg = await card("theme=dark");
    const periods = (cls: string) => [...svg.matchAll(new RegExp(`class="${cls}[^"]*" style="animation-duration:([0-9.]+)s`, "g"))].map((m) => Number(m[1]));
    expect(periods("hy a[12]").length).toBeGreaterThan(0);
    for (const p of periods("gw")) expect(p).toBeGreaterThanOrEqual(5), expect(p).toBeLessThanOrEqual(11);
    for (const p of periods("hy a[12]")) expect(p).toBeGreaterThanOrEqual(5.5), expect(p).toBeLessThanOrEqual(9);
    for (const p of periods("hx")) expect(p).toBeGreaterThanOrEqual(8), expect(p).toBeLessThanOrEqual(13);
    expect(new Set(periods("gw")).size).toBeGreaterThan(3);
  });

  it("stops for reduced motion, and animate=false renders the same resting frame", async () => {
    const moving = await card("theme=dark");
    const still = await card("theme=dark&animate=false");
    expect(moving).toContain("@media (prefers-reduced-motion:reduce){.tw,.gw,.gi,.gs,.neb,.hy,.hx{animation:none}}");
    expect(still).not.toContain("@keyframes");
    expect(still).not.toContain("animation");
    // the resting frame: same drawing, same resting opacities, without keyframes or timing
    const rest = moving.replace(/ style="animation-[^"]*"/g, "").replace(/@keyframes.*?\}\}(?=\.tw\{animation)/, "").replace(/\.tw\{animation.*?\{animation:none\}\}/, "");
    expect(still).toBe(rest);
  });
});
