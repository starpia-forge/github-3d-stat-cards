import { parseConfig } from "./config.js";
import { fetchActivity } from "./github/contributions.js";
import { createGraphQL, GitHubError, type GraphQL } from "./github/graphql.js";
import { renderCard } from "./render/card.js";
import { renderFallback } from "./render/fallback.js";

export interface Deps {
  /** The raw `card.config.json`. */
  config: unknown;
  token: string | undefined;
  now: () => Date;
  /** Overrides the GitHub client (tests). */
  gql?: GraphQL;
}

/** Six hours in the CDN and in GitHub's image proxy. */
export const CARD_CACHE = "public, max-age=21600, s-maxage=21600";

/** `/api/milky-way`: answers with the Subject's Card, or a Fallback Card when none can be drawn. */
export async function handleMilkyWay(_request: Request, deps: Deps): Promise<Response> {
  const parsed = parseConfig(deps.config);
  if (!parsed.ok) return fallback("Card is not configured", parsed.reason);
  const { config } = parsed;
  if (!deps.token && !deps.gql) return fallback("Card is not configured", "GITHUB_TOKEN is not set");
  const gql = deps.gql ?? createGraphQL(deps.token!);
  try {
    const result = await fetchActivity(gql, config.username, deps.now());
    if (result.kind === "missing") return fallback("Unknown GitHub user", `No GitHub user is called ${config.username}`);
    if (result.kind === "organization") return fallback("Organizations are not supported", `${result.login} is an organization`);
    if (result.activity.repos.length === 0) return fallback("No Activity yet", `${result.activity.login} has no public commits`);
    return svg(renderCard(result.activity, config), CARD_CACHE);
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "rate-limited") return fallback("GitHub is busy", "Try again in a little while");
    return fallback("GitHub could not be reached", "Try again in a little while");
  }
}

const svg = (body: string, cache: string) =>
  new Response(body, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": cache } });

const fallback = (title: string, detail: string) => svg(renderFallback(title, detail), "no-store");
