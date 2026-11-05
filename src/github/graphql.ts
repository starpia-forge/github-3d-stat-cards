/** A GitHub GraphQL call: one query document and its variables in, the `data` object out. */
export type GraphQL = <T = any>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly kind: "rate-limited" | "unauthorized" | "failed",
  ) {
    super(message);
  }
}

/**
 * The GitHub GraphQL client. Any error in a response fails the whole call, so a partial answer
 * can never be stored as if it were complete. `NOT_FOUND` alone is not an error here: it is how
 * GitHub says a login does not exist, and the data says the same with a null.
 */
export function createGraphQL(token: string, fetchImpl: typeof fetch = fetch): GraphQL {
  return async (query, variables = {}) => {
    const res = await fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "github-milkyway-stat-cards" },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) throw new GitHubError("GitHub rejected the token", "unauthorized");
    if (res.status === 403 || res.status === 429) {
      const limited = res.status === 429 || res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after") || /rate limit/i.test(await res.text().catch(() => ""));
      throw new GitHubError(`GitHub answered ${res.status}`, limited ? "rate-limited" : "unauthorized");
    }
    if (!res.ok) throw new GitHubError(`GitHub answered ${res.status}`, "failed");
    const json = (await res.json()) as { data?: any; errors?: { type?: string; message: string }[] };
    const errors = (json.errors ?? []).filter((e) => e.type !== "NOT_FOUND");
    if (errors.some((e) => e.type === "RATE_LIMITED")) throw new GitHubError("GitHub rate limit", "rate-limited");
    if (errors.length || !json.data) throw new GitHubError(errors.map((e) => e.message).join("; ") || "GitHub returned no data", "failed");
    return json.data;
  };
}
