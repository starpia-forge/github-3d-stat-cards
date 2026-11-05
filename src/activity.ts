/** The Subject's Activity, shaped per repository and per Period. */

/** A calendar month, `YYYY-MM`. */
export type Period = string;

export interface LanguageShare {
  name: string;
  /** Linguist colour, `#rrggbb`, or null when Linguist has none. */
  color: string | null;
  /** Share of the repository's bytes, 0–1. */
  share: number;
}

export interface RepoActivity {
  /** Stable opaque key (a hash); never reveals a private repository's name. */
  key: string;
  /** `owner/name` for public repositories; always null for private ones. */
  name: string | null;
  isPrivate: boolean;
  /** The Subject's commits per Period. */
  months: Record<Period, number>;
  total: number;
  /** Language Mix by current bytes, largest first. */
  languages: LanguageShare[];
}

export interface Activity {
  login: string;
  /** ISO timestamp of the fetch; "today" for the Card. */
  fetchedAt: string;
  /** False when GitHub's limits left a gap: the totals are lower bounds. */
  complete?: boolean;
  repos: RepoActivity[];
}

export const periodOf = (d: Date): Period => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Months since year 0 — a linear index for Periods. */
export const periodIndex = (p: Period): number => {
  const [y, m] = p.split("-").map(Number);
  return y! * 12 + (m! - 1);
};

export const periodFromIndex = (i: number): Period => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

/**
 * GitHub reports a contribution day as the Subject's local midnight in UTC
 * (`2024-02-29T15:00:00Z` is 1 March in UTC+9). Rounding to the nearest UTC
 * midnight recovers the local calendar day for offsets between −12 h and +12 h.
 */
export function contributionDay(occurredAt: string): Date {
  const t = Date.parse(occurredAt);
  const DAY = 86_400_000;
  return new Date(Math.floor((t + DAY / 2) / DAY) * DAY);
}

export const primaryLanguage = (r: RepoActivity): LanguageShare | undefined => r.languages[0];

/** The commit-weighted middle of a repository's Activity, as a fractional period index. */
export function middlePeriod(r: RepoActivity): number {
  let sum = 0;
  let weight = 0;
  for (const [p, c] of Object.entries(r.months)) {
    sum += (periodIndex(p) + 0.5) * c;
    weight += c;
  }
  return weight ? sum / weight : NaN;
}
