import { periodIndex, periodOf, type RepoActivity } from "./activity.js";

/** Languages outside the top six fold into Other. */
export const OTHER = "Other";
export const TOP_LANGUAGES = 6;
/** A colour key: a top Language, Other, or null for an uncoloured repository. */
export type LanguageKey = string | null;

export interface Languages {
  /** The six Languages with the most all-time Attribution, after `hide`. */
  top: { name: string; color: string | null }[];
  /** Last 12 months: the top six plus Other with Attribution shares (zero shares kept for top Languages). */
  legend: { key: string; share: number }[];
  /** No Attribution in the last 12 months. */
  empty: boolean;
  keyOf(language: string): string;
  /** The repository's Language Mix by colour key, renormalised after `hide`, largest first. */
  mixOf(r: RepoActivity): { key: string; share: number }[];
  /** The Primary Language's colour key, or null when no Language is left. */
  primaryOf(r: RepoActivity): LanguageKey;
}

/** Attribution (commits × current Language Mix, per Period), ranking, and the legend. */
export function buildLanguages(repos: RepoActivity[], hide: string[], now: Date): Languages {
  const hidden = new Set(hide.map((h) => h.toLowerCase()));
  const mixes = new Map<RepoActivity, { name: string; color: string | null; share: number }[]>();
  for (const r of repos) {
    const kept = r.languages.filter((l) => !hidden.has(l.name.toLowerCase()) && l.share > 0);
    const sum = kept.reduce((a, l) => a + l.share, 0);
    mixes.set(r, sum ? kept.map((l) => ({ ...l, share: l.share / sum })) : []);
  }
  const lastPeriod = periodIndex(periodOf(now));
  const allTime = new Map<string, number>();
  const recent = new Map<string, number>();
  const colors = new Map<string, string | null>();
  for (const r of repos) {
    for (const [p, c] of Object.entries(r.months)) {
      const isRecent = lastPeriod - periodIndex(p) < 12;
      for (const l of mixes.get(r)!) {
        colors.set(l.name, l.color);
        allTime.set(l.name, (allTime.get(l.name) ?? 0) + c * l.share);
        if (isRecent) recent.set(l.name, (recent.get(l.name) ?? 0) + c * l.share);
      }
    }
  }
  const ranked = [...allTime.keys()].sort((a, b) => allTime.get(b)! - allTime.get(a)! || a.localeCompare(b));
  const topNames = ranked.slice(0, TOP_LANGUAGES);
  const isTop = new Set(topNames);
  const keyOf = (name: string) => (isTop.has(name) ? name : OTHER);

  const recentByKey = new Map<string, number>();
  for (const [name, v] of recent) recentByKey.set(keyOf(name), (recentByKey.get(keyOf(name)) ?? 0) + v);
  const recentSum = [...recentByKey.values()].reduce((a, b) => a + b, 0);
  const keys = [...topNames, ...(ranked.length > TOP_LANGUAGES ? [OTHER] : [])];
  const legend = recentSum
    ? keys
        .map((key) => ({ key, share: (recentByKey.get(key) ?? 0) / recentSum }))
        .sort((a, b) => b.share - a.share || keys.indexOf(a.key) - keys.indexOf(b.key))
    : [];

  return {
    top: topNames.map((name) => ({ name, color: colors.get(name) ?? null })),
    legend,
    empty: recentSum === 0,
    keyOf,
    mixOf(r) {
      const byKey = new Map<string, number>();
      for (const l of mixes.get(r) ?? []) byKey.set(keyOf(l.name), (byKey.get(keyOf(l.name)) ?? 0) + l.share);
      return [...byKey].map(([key, share]) => ({ key, share })).sort((a, b) => b.share - a.share);
    },
    primaryOf(r) {
      const first = mixes.get(r)?.[0];
      return first ? keyOf(first.name) : null;
    },
  };
}
