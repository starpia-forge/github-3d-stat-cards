import { createHash } from "node:crypto";
import { contributionDay, periodOf, type Activity, type LanguageShare, type RepoActivity } from "../activity.js";
import type { PrivateLevel } from "../config.js";
import type { GraphQL } from "./graphql.js";

export type SubjectResult =
  | { kind: "user"; activity: Activity }
  | { kind: "organization"; login: string }
  | { kind: "missing" }
  /** `private` is on, but the token belongs to someone other than the Subject. */
  | { kind: "private-mismatch"; tokenOwner: string };

const SUBJECT = `query($login: String!) {
  repositoryOwner(login: $login) {
    __typename login
    ... on User { contributionsCollection { contributionYears } }
  }
}`;

const VIEWER = `query { viewer { login } }`;

const WINDOW = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  rateLimit { cost }
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalRepositoriesWithContributedCommits
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          id nameWithOwner isPrivate owner { login }
          languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
            totalSize edges { size node { name color } }
          }
        }
        contributions(first: 100) { totalCount nodes { occurredAt commitCount } }
      }
    }
  }
}`;

export interface WindowEntry {
  repository: {
    id: string;
    nameWithOwner: string;
    isPrivate: boolean;
    owner: { login: string };
    languages: { totalSize: number; edges: { size: number; node: { name: string; color: string | null } }[] };
  };
  contributions: { totalCount: number; nodes: { occurredAt: string; commitCount: number }[] };
}

export interface WindowData {
  rateLimit?: { cost: number };
  user: {
    contributionsCollection: {
      totalRepositoriesWithContributedCommits: number;
      commitContributionsByRepository: WindowEntry[];
    };
  } | null;
}

export interface FetchOptions {
  /** Which private repositories count (default `off`: public only). */
  private?: PrivateLevel;
  log?: (message: string) => void;
}

/** GitHub returns at most this many repositories per window and this many days per repository. */
export const MAX_REPOSITORIES = 100;
export const MAX_DAYS = 100;

/**
 * A window is cut short when a repository's returned days hold fewer commits than its total
 * (`contributions.totalCount` counts commits, not days), or when more repositories exist than returned.
 */
export function truncation(page: WindowData): { days: boolean; repositories: boolean } {
  const cc = page.user?.contributionsCollection;
  if (!cc) return { days: false, repositories: false };
  return {
    days: cc.commitContributionsByRepository.some((e) => e.contributions.nodes.reduce((a, d) => a + d.commitCount, 0) < e.contributions.totalCount),
    repositories: cc.commitContributionsByRepository.length >= MAX_REPOSITORIES && cc.totalRepositoriesWithContributedCommits > cc.commitContributionsByRepository.length,
  };
}

/** Calendar-month windows covering one year, ending at `now`; disjoint, so no day is counted twice. */
export function monthlyWindows(year: number, now: Date): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const start = Date.UTC(year, m, 1);
    if (start > now.getTime()) break;
    out.push({ from: new Date(start).toISOString(), to: new Date(Math.min(Date.UTC(year, m + 1, 1) - 1000, now.getTime())).toISOString() });
  }
  return out;
}

/** Reads the Subject's commit Activity, one contribution year per query. */
export async function fetchActivity(gql: GraphQL, login: string, now: Date, options: FetchOptions = {}): Promise<SubjectResult> {
  const level = options.private ?? "off";
  const owner = (await gql<{ repositoryOwner: any }>(SUBJECT, { login })).repositoryOwner;
  if (!owner) return { kind: "missing" };
  if (owner.__typename !== "User") return { kind: "organization", login: owner.login };
  if (level !== "off") {
    // Private Activity is only read with the Subject's own token.
    const viewer = (await gql<{ viewer: { login: string } }>(VIEWER)).viewer.login;
    if (viewer.toLowerCase() !== owner.login.toLowerCase()) return { kind: "private-mismatch", tokenOwner: viewer };
  }
  const years: number[] = owner.contributionsCollection.contributionYears;
  let queries = 1;
  let cost = 0;
  const ask = async (w: { from: string; to: string }) => {
    queries++;
    const page = await gql<WindowData>(WINDOW, { login, ...w });
    cost += page.rateLimit?.cost ?? 1;
    return page;
  };
  let complete = true;
  const perYear = await Promise.all(
    years.map(async (y) => {
      const yearly = await ask({ from: new Date(Date.UTC(y, 0, 1)).toISOString(), to: new Date(Math.min(Date.UTC(y + 1, 0, 1) - 1000, now.getTime())).toISOString() });
      const cut = truncation(yearly);
      if (!cut.days && !cut.repositories) return [yearly];
      // Fill the year in with monthly windows instead of the cut-short yearly one.
      const months = await Promise.all(monthlyWindows(y, now).map(ask));
      for (const m of months) {
        const c = truncation(m);
        if (c.days || c.repositories) complete = false;
      }
      return months;
    }),
  );
  options.log?.(`GitHub GraphQL: ${queries} queries, cost ${cost} for ${owner.login}${complete ? "" : " (incomplete)"}`);
  const repos = aggregate(perYear.flat(), { level, login: owner.login });
  return { kind: "user", activity: { login: owner.login, fetchedAt: now.toISOString(), complete, repos } };
}

/** Whether a repository's Activity counts at this `private` level. */
export function counts(repo: WindowEntry["repository"], level: PrivateLevel, subject: string): boolean {
  if (!repo.isPrivate) return true;
  if (level === "all") return true;
  return level === "owned" && repo.owner.login.toLowerCase() === subject.toLowerCase();
}

/** Sums daily commit contributions into monthly Periods per repository. */
export function aggregate(pages: WindowData[], scope: { level: PrivateLevel; login: string } = { level: "off", login: "" }): RepoActivity[] {
  const repos = new Map<string, RepoActivity>();
  for (const page of pages) {
    for (const entry of page.user?.contributionsCollection.commitContributionsByRepository ?? []) {
      const { repository: repo } = entry;
      if (!counts(repo, scope.level, scope.login)) continue;
      // keyed by GitHub's opaque node id, so the key never reveals (or can be guessed from) a name
      const key = createHash("sha256").update(repo.id).digest("hex").slice(0, 16);
      let r = repos.get(key);
      if (!r) {
        r = { key, name: repo.isPrivate ? null : repo.nameWithOwner, isPrivate: repo.isPrivate, months: {}, total: 0, languages: mix(repo.languages) };
        repos.set(key, r);
      }
      for (const day of entry.contributions.nodes) {
        if (day.commitCount <= 0) continue;
        const p = periodOf(contributionDay(day.occurredAt));
        r.months[p] = (r.months[p] ?? 0) + day.commitCount;
        r.total += day.commitCount;
      }
    }
  }
  return [...repos.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

function mix(languages: WindowEntry["repository"]["languages"]): LanguageShare[] {
  const total = languages.totalSize;
  if (!total) return [];
  return languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, share: e.size / total }));
}
