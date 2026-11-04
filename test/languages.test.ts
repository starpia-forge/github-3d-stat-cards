import { describe, expect, it } from "vitest";
import type { RepoActivity } from "../src/activity.js";
import { buildLanguages, OTHER } from "../src/languages.js";
import { colorOf } from "../src/render/palette.js";

const now = new Date("2024-12-15T00:00:00Z");
let k = 0;
const repo = (months: Record<string, number>, langs: [string, number][]): RepoActivity => ({
  key: `r${k++}`,
  name: null,
  isPrivate: false,
  months,
  total: Object.values(months).reduce((a, b) => a + b, 0),
  languages: langs.map(([name, share]) => ({ name, color: `#${(name.length * 1234567).toString(16).slice(0, 6).padEnd(6, "0")}`, share })),
});

describe("buildLanguages", () => {
  it("ranks Languages by all-time Attribution and folds the rest into Other", () => {
    const repos = [
      repo({ "2024-01": 100 }, [["A", 0.6], ["B", 0.4]]),
      repo({ "2024-02": 50 }, [["C", 1]]),
      repo({ "2024-03": 10 }, [["D", 0.5], ["E", 0.3], ["F", 0.1], ["G", 0.1]]),
    ];
    const l = buildLanguages(repos, [], now);
    expect(l.top.map((t) => t.name)).toEqual(["A", "C", "B", "D", "E", "F"]);
    expect(l.keyOf("G")).toBe(OTHER);
    expect(l.mixOf(repos[2]!).map((m) => m.key)).toEqual(["D", "E", "F", OTHER]);
  });

  it("legend shows the last 12 months, top six plus Other, shares summing to 1", () => {
    const repos = [
      repo({ "2023-01": 1000 }, [["Old", 1]]),
      repo({ "2024-06": 30 }, [["A", 1]]),
      repo({ "2024-07": 10 }, [["B", 1]]),
    ];
    const l = buildLanguages(repos, [], now);
    expect(l.legend).toEqual([
      { key: "A", share: 0.75 },
      { key: "B", share: 0.25 },
      { key: "Old", share: 0 },
    ]);
  });

  it("hide removes Languages from colours and the legend, renormalising, and recomputes the Primary Language", () => {
    const r = repo({ "2024-06": 10 }, [["HTML", 0.7], ["TypeScript", 0.3]]);
    const l = buildLanguages([r], ["html"], now);
    expect(l.top.map((t) => t.name)).toEqual(["TypeScript"]);
    expect(l.primaryOf(r)).toBe("TypeScript");
    expect(l.mixOf(r)).toEqual([{ key: "TypeScript", share: 1 }]);
    expect(l.legend).toEqual([{ key: "TypeScript", share: 1 }]);
  });

  it("a repository with no Language left is uncoloured, which is not Other", () => {
    const hidden = repo({ "2024-06": 5 }, [["HTML", 1]]);
    const none = repo({ "2024-06": 5 }, []);
    const l = buildLanguages([hidden, none], ["HTML"], now);
    expect(l.primaryOf(hidden)).toBeNull();
    expect(l.primaryOf(none)).toBeNull();
    expect(l.mixOf(none)).toEqual([]);
    expect(l.legend).toEqual([]);
    expect(l.empty).toBe(true);
  });

  it("has an empty legend when nothing happened in the last 12 months", () => {
    const l = buildLanguages([repo({ "2022-01": 5 }, [["Go", 1]])], [], now);
    expect(l.empty).toBe(true);
    expect(l.top.map((t) => t.name)).toEqual(["Go"]);
  });
});

describe("colorOf", () => {
  const l = buildLanguages([repo({ "2024-06": 5 }, [["Dark", 1]])], [], now);
  it("lightens dark hues in dark mode and mixes toward white in light mode", () => {
    const base = l.top[0]!.color;
    expect(colorOf(l, "Dark", "dark")).not.toBe(base);
    expect(colorOf(l, "Dark", "light")).not.toBe(base);
  });
  it("keeps Other neutral grey and uncoloured distinct from it", () => {
    expect(colorOf(l, OTHER, "dark")).toBe("#8d96a3");
    expect(colorOf(l, null, "dark")).toBe("#c9d1d9");
    expect(colorOf(l, null, "light")).toBe("#2f343c");
    expect(colorOf(l, null, "dark")).not.toBe(colorOf(l, OTHER, "dark"));
  });
});
