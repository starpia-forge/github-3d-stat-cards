import type { GraphQL } from "../src/github/graphql.js";

/** One day of commits to one repository, as GitHub reports it (local midnight in UTC). */
export interface Day {
  repo: string;
  occurredAt: string;
  commitCount: number;
}

/**
 * A fake GitHub that answers contribution queries from day-level truth, applying GitHub's
 * limits: at most 100 repositories per window (most commits first) and 100 days per repository,
 * with `totalCount` counting commits.
 */
export function fakeGitHub(login: string, days: Day[], years: number[]) {
  const windows: { from: string; to: string }[] = [];
  const gql: GraphQL = async (query, vars: any = {}) => {
    if (query.includes("repositoryOwner")) return { repositoryOwner: { __typename: "User", login, contributionsCollection: { contributionYears: years } } } as any;
    if (query.includes("viewer")) return { viewer: { login } } as any;
    windows.push({ from: vars.from, to: vars.to });
    const from = Date.parse(vars.from);
    const to = Date.parse(vars.to);
    const inWindow = days.filter((d) => Date.parse(d.occurredAt) >= from && Date.parse(d.occurredAt) <= to);
    const byRepo = new Map<string, Day[]>();
    for (const d of inWindow) byRepo.set(d.repo, [...(byRepo.get(d.repo) ?? []), d]);
    const ranked = [...byRepo].sort((a, b) => b[1].reduce((s, d) => s + d.commitCount, 0) - a[1].reduce((s, d) => s + d.commitCount, 0) || a[0].localeCompare(b[0]));
    return {
      rateLimit: { cost: 1 },
      user: {
        contributionsCollection: {
          totalRepositoriesWithContributedCommits: ranked.length,
          commitContributionsByRepository: ranked.slice(0, 100).map(([repo, ds]) => ({
            repository: { id: `R_${repo}`, nameWithOwner: `${login}/${repo}`, isPrivate: false, owner: { login }, languages: { totalSize: 1, edges: [{ size: 1, node: { name: "Go", color: "#00ADD8" } }] } },
            contributions: { totalCount: ds.reduce((s, d) => s + d.commitCount, 0), nodes: ds.slice(0, 100).map(({ occurredAt, commitCount }) => ({ occurredAt, commitCount })) },
          })),
        },
      },
    } as any;
  };
  return { gql, windows };
}

/** Every day of a year for one repository, at UTC midnight. */
export function everyDay(repo: string, year: number, commitCount = 1): Day[] {
  const out: Day[] = [];
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86_400_000) out.push({ repo, occurredAt: new Date(t).toISOString(), commitCount });
  return out;
}
