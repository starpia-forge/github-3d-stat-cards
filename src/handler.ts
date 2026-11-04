import { parseConfig, type CardConfig } from "./config.js";
import { fetchActivity, type SubjectResult } from "./github/contributions.js";
import { createGraphQL, GitHubError, type GraphQL } from "./github/graphql.js";
import { renderCard, type RenderOptions } from "./render/card.js";
import { renderFallback } from "./render/fallback.js";
import { isStale, readStored, storageKey, type Store, type Stored } from "./store.js";

export interface Deps {
  /** The raw `card.config.json`. */
  config: unknown;
  token: string | undefined;
  now: () => Date;
  store: Store;
  /** Keeps background work alive after the response (Vercel's `waitUntil`). */
  waitUntil: (work: Promise<unknown>) => void;
  /** Overrides the GitHub client (tests). */
  gql?: GraphQL;
  /** Resolves after `ms`; replaceable so tests control the first-render budget. */
  delay?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

/** Six hours in the CDN and in GitHub's image proxy. */
export const CARD_CACHE = "public, max-age=21600, s-maxage=21600";
/** The first render waits this long for GitHub; GitHub's image proxy gives up after about 10 s. */
export const FIRST_RENDER_BUDGET_MS = 7_000;

/** `/api/milky-way`: answers with the Subject's Card, or a Fallback Card when none can be drawn. */
export async function handleMilkyWay(request: Request, deps: Deps): Promise<Response> {
  const options = optionsOf(new URL(request.url));
  const ready = prepare(deps);
  if ("fallback" in ready) return ready.fallback;
  const { config, key, refresh } = ready;

  const stored = await readStored(deps.store, key);
  if (stored) {
    if (isStale(stored, deps.now())) deps.waitUntil(refresh().catch((e) => deps.log?.(`background refresh failed: ${e}`)));
    return card(stored, config, options);
  }

  // First render: fetch inline within the budget, otherwise finish in the background.
  const work = refresh();
  const delay = deps.delay ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms).unref()));
  const raced = await Promise.race([work.then((r) => ({ done: r }), (e: unknown) => ({ failed: e })), delay(FIRST_RENDER_BUDGET_MS).then(() => "late" as const)]);
  if (raced === "late") {
    deps.waitUntil(work.catch((e) => deps.log?.(`first fetch failed: ${e}`)));
    return fallback("Preparing the Milky Way", "The first map takes a moment; check back soon");
  }
  if ("failed" in raced) return githubFallback(raced.failed);
  return subjectResponse(raced.done.result, raced.done.stored, config, options);
}

/** The daily refresh (Vercel Cron). */
export async function handleRefresh(request: Request, deps: Deps & { cronSecret?: string }): Promise<Response> {
  if (deps.cronSecret && request.headers.get("authorization") !== `Bearer ${deps.cronSecret}`) return new Response("unauthorized", { status: 401 });
  const ready = prepare(deps);
  if ("fallback" in ready) return new Response("not configured", { status: 500 });
  try {
    const { result } = await ready.refresh();
    return Response.json({ refreshed: result.kind === "user", kind: result.kind });
  } catch (e) {
    return Response.json({ refreshed: false, error: String(e) }, { status: 502 });
  }
}

function prepare(deps: Deps): { fallback: Response } | { config: CardConfig; key: string; refresh: () => Promise<{ result: SubjectResult; stored?: Stored }> } {
  const parsed = parseConfig(deps.config);
  if (!parsed.ok) return { fallback: fallback("Card is not configured", parsed.reason) };
  const { config } = parsed;
  if (!deps.token && !deps.gql) return { fallback: fallback("Card is not configured", "GITHUB_TOKEN is not set") };
  const token = deps.token ?? "";
  const key = storageKey(config, token);
  const gql = deps.gql ?? createGraphQL(token);
  /** Fetches from GitHub and stores a successful result; a failure leaves stored data untouched. */
  const refresh = async () => {
    const result = await fetchActivity(gql, config.username, deps.now(), { private: config.private, log: deps.log });
    if (result.kind !== "user" || result.activity.repos.length === 0) return { result };
    const complete = result.activity.complete !== false;
    const stored: Stored = { version: 1, key, activity: result.activity, storedAt: deps.now().toISOString(), complete };
    if (!complete) {
      // An incomplete refresh never replaces complete stored data; only the refresh time moves on.
      const previous = await readStored(deps.store, key);
      if (previous?.complete) {
        const kept = { ...previous, storedAt: stored.storedAt };
        await deps.store.set(key, kept);
        return { result, stored: kept };
      }
    }
    await deps.store.set(key, stored);
    return { result, stored };
  };
  return { config, key, refresh };
}

function subjectResponse(result: SubjectResult, stored: Stored | undefined, config: CardConfig, options: RenderOptions): Response {
  if (result.kind === "missing") return fallback("Unknown GitHub user", `No GitHub user is called ${config.username}`);
  if (result.kind === "organization") return fallback("Organizations are not supported", `${result.login} is an organization`);
  if (result.kind === "private-mismatch") return fallback("Private Activity needs the Subject's own token", `The token belongs to ${result.tokenOwner}, not ${config.username}`);
  if (!stored) return fallback("No Activity yet", `${result.activity.login} has no public commits`);
  return card(stored, config, options);
}

function githubFallback(e: unknown): Response {
  if (e instanceof GitHubError && e.kind === "rate-limited") return fallback("GitHub is busy", "Try again in a little while");
  return fallback("GitHub could not be reached", "Try again in a little while");
}

const card = (stored: Stored, config: CardConfig, options: RenderOptions) => svg(renderCard(stored.activity, config, options), CARD_CACHE);

const svg = (body: string, cache: string) =>
  new Response(body, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": cache } });

const fallback = (title: string, detail: string) => svg(renderFallback(title, detail), "no-store");

/** URL parameters: `theme=light|dark` (default: follow prefers-color-scheme) and `animate=false`. */
export function optionsOf(url: URL): RenderOptions {
  const theme = url.searchParams.get("theme");
  return { theme: theme === "light" || theme === "dark" ? theme : "auto", animate: url.searchParams.get("animate") !== "false" };
}
