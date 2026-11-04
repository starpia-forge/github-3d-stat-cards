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

export function createGraphQL(token: string, fetchImpl: typeof fetch = fetch): GraphQL {
  return async (query, variables = {}) => {
    const res = await fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "github-3d-stat-cards" },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) throw new GitHubError("GitHub rejected the token", "unauthorized");
    if (res.status === 403 || res.status === 429) throw new GitHubError(`GitHub rate limit (${res.status})`, "rate-limited");
    if (!res.ok) throw new GitHubError(`GitHub answered ${res.status}`, "failed");
    const json = (await res.json()) as { data?: any; errors?: { type?: string; message: string }[] };
    if (json.errors?.some((e) => e.type === "RATE_LIMITED")) throw new GitHubError("GitHub rate limit", "rate-limited");
    if (json.errors?.length && !json.data) throw new GitHubError(json.errors.map((e) => e.message).join("; "), "failed");
    return json.data;
  };
}
