import { createHash } from "node:crypto";
import type { Activity, RepoActivity } from "../src/activity.js";

const LANGS = [
  ["TypeScript", "#3178c6"], ["Go", "#00ADD8"], ["Rust", "#dea584"], ["Python", "#3572A5"], ["C#", "#178600"],
  ["JavaScript", "#f1e05a"], ["Shell", "#89e051"], ["HTML", "#e34c26"], ["CSS", "#563d7c"], ["Kotlin", "#A97BFF"],
] as const;

/** A deterministic pseudo-random generator for synthetic fixtures. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

export interface SyntheticSpec {
  seed: number;
  now: string;
  repos: { total: number; from: string; months: number; langs?: number; isPrivate?: boolean; name?: string }[];
}

/** Builds Activity from a compact description: each repository spreads its commits over a run of months. */
export function synthetic(spec: SyntheticSpec): Activity {
  const rand = rng(spec.seed);
  const repos: RepoActivity[] = spec.repos.map((r, i) => {
    const name = r.name ?? `synthetic/repo-${i}`;
    const [y, m] = r.from.split("-").map(Number);
    const months: Record<string, number> = {};
    let left = r.total;
    for (let k = 0; k < r.months && left > 0; k++) {
      const c = k === r.months - 1 ? left : Math.min(left, Math.max(1, Math.round((r.total / r.months) * (0.4 + rand() * 1.2))));
      const idx = y! * 12 + m! - 1 + k;
      const p = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
      months[p] = (months[p] ?? 0) + c;
      left -= c;
    }
    const n = r.langs ?? 1 + Math.floor(rand() * 4);
    const first = Math.floor(rand() * LANGS.length);
    const weights = Array.from({ length: n }, (_, j) => (j === 0 ? 3 : rand()));
    const sum = weights.reduce((a, b) => a + b, 0);
    return {
      key: createHash("sha256").update(name).digest("hex").slice(0, 16),
      name: r.isPrivate ? null : name,
      isPrivate: !!r.isPrivate,
      months,
      total: Object.values(months).reduce((a, b) => a + b, 0),
      languages: weights.map((w, j) => ({ name: LANGS[(first + j) % LANGS.length]![0], color: LANGS[(first + j) % LANGS.length]![1], share: w / sum })),
    };
  });
  return { login: "synthetic", fetchedAt: spec.now, repos: repos.filter((r) => r.total > 0).sort((a, b) => b.total - a.total) };
}
