import { createHash } from "node:crypto";
import { contributionDay, periodOf, type Activity, type LanguageShare, type RepoActivity } from "../activity.js";
import type { GraphQL } from "./graphql.js";

export type SubjectResult =
  | { kind: "user"; activity: Activity }
  | { kind: "organization"; login: string }
  | { kind: "missing" };

const SUBJECT = `query($login: String!) {
  repositoryOwner(login: $login) {
    __typename login
    ... on User { contributionsCollection { contributionYears } }
  }
}`;

const YEAR = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalRepositoriesWithContributedCommits
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          nameWithOwner isPrivate
          languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
            totalSize edges { size node { name color } }
          }
        }
        contributions(first: 100) { totalCount nodes { occurredAt commitCount } }
      }
    }
  }
}`;

interface YearData {
  user: {
    contributionsCollection: {
      totalRepositoriesWithContributedCommits: number;
      commitContributionsByRepository: {
        repository: {
          nameWithOwner: string;
          isPrivate: boolean;
          languages: { totalSize: number; edges: { size: number; node: { name: string; color: string | null } }[] };
        };
        contributions: { totalCount: number; nodes: { occurredAt: string; commitCount: number }[] };
      }[];
    };
  } | null;
}

/** Reads the Subject's public commit Activity, one contribution year per query. */
export async function fetchActivity(gql: GraphQL, login: string, now: Date): Promise<SubjectResult> {
  const owner = (await gql<{ repositoryOwner: any }>(SUBJECT, { login })).repositoryOwner;
  if (!owner) return { kind: "missing" };
  if (owner.__typename !== "User") return { kind: "organization", login: owner.login };
  const years: number[] = owner.contributionsCollection.contributionYears;
  const windows = years.map((y) => ({
    from: new Date(Date.UTC(y, 0, 1)).toISOString(),
    to: new Date(Math.min(Date.UTC(y + 1, 0, 1) - 1000, now.getTime())).toISOString(),
  }));
  const pages = await Promise.all(windows.map((w) => gql<YearData>(YEAR, { login, ...w })));
  return { kind: "user", activity: { login: owner.login, fetchedAt: now.toISOString(), repos: aggregate(pages) } };
}

/** Sums daily commit contributions into monthly Periods per repository. */
export function aggregate(pages: YearData[]): RepoActivity[] {
  const repos = new Map<string, RepoActivity>();
  for (const page of pages) {
    for (const entry of page.user?.contributionsCollection.commitContributionsByRepository ?? []) {
      const { repository: repo } = entry;
      const key = createHash("sha256").update(repo.nameWithOwner.toLowerCase()).digest("hex").slice(0, 16);
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

function mix(languages: NonNullable<YearData["user"]>["contributionsCollection"]["commitContributionsByRepository"][number]["repository"]["languages"]): LanguageShare[] {
  const total = languages.totalSize;
  if (!total) return [];
  return languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, share: e.size / total }));
}
