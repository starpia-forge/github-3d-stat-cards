import { parseConfig, type CardConfig } from "./config.js";
import { fetchActivity, type SubjectResult } from "./github/contributions.js";
import { createGraphQL, GitHubError, type GraphQL } from "./github/graphql.js";
import { renderCard, type RenderOptions } from "./render/card.js";
import { renderFallback, type FallbackReason } from "./render/fallback.js";
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
  /** Refreshes in flight and recent failures; shared by the requests one instance serves. */
  refreshes?: RefreshState;
}

/** Keeps one instance from refreshing the same data twice at once, or retrying a failure on every request. */
export interface RefreshState {
  inFlight: Map<string, Promise<RefreshOutcome>>;
  failedAt: Map<string, number>;
}

export interface RefreshOutcome {
  result: SubjectResult;
  /** What is now stored; absent when GitHub's answer is not a Subject. */
  stored?: Stored;
}

const instanceRefreshes: RefreshState = { inFlight: new Map(), failedAt: new Map() };
/** After a failed background refresh, stored data is served without retrying for this long. */
export const RETRY_AFTER_MS = 15 * 60_000;

/** Six hours in the CDN and in GitHub's image proxy. */
export const CARD_CACHE = "public, max-age=21600, s-maxage=21600";
/** The first render waits this long for GitHub; GitHub's image proxy gives up after about 10 s. */
export const FIRST_RENDER_BUDGET_MS = 7_000;

/** `/api/milky-way`: answers with the Subject's Card, or a Fallback Card when none can be drawn. */
export async function handleMilkyWay(request: Request, deps: Deps): Promise<Response> {
  const options = optionsOf(new URL(request.url));
  const fallback = (reason: FallbackReason) => svg(renderFallback(reason, options, deps.now()), "no-store");
  const ready = prepare(deps);
  if ("reason" in ready) return fallback(ready.reason);
  const { config, key, refresh } = ready;

  const stored = await readStored(deps.store, key);
  if (stored) {
    if (isStale(stored, deps.now()) && !ready.recentlyFailed()) deps.waitUntil(refresh().catch((e) => deps.log?.(`background refresh failed: ${e}`)));
    if (!stored.activity.repos.length) return fallback({ kind: "no-activity", login: stored.activity.login });
    return card(stored, config, options);
  }

  // First render: fetch inline within the budget, otherwise finish in the background.
  const work = refresh();
  const delay = deps.delay ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms).unref()));
  const raced = await Promise.race([work.then((r) => ({ done: r }), (e: unknown) => ({ failed: e })), delay(FIRST_RENDER_BUDGET_MS).then(() => "late" as const)]);
  if (raced === "late") {
    deps.waitUntil(work.catch((e) => deps.log?.(`first fetch failed: ${e}`)));
    return fallback({ kind: "preparing" });
  }
  if ("failed" in raced) return fallback(githubReason(raced.failed));
  const { result, stored: fresh } = raced.done;
  if (result.kind === "missing") return fallback({ kind: "unknown-subject", login: config.username });
  if (result.kind === "organization") return fallback({ kind: "organization", login: result.login });
  if (result.kind === "private-mismatch") return fallback({ kind: "private-mismatch", login: config.username, tokenOwner: result.tokenOwner });
  if (!fresh?.activity.repos.length) return fallback({ kind: "no-activity", login: result.activity.login });
  return card(fresh, config, options);
}

/** The daily refresh (Vercel Cron). Closed unless CRON_SECRET is set, so nobody else can spend the Host's GitHub quota. */
export async function handleRefresh(request: Request, deps: Deps & { cronSecret?: string }): Promise<Response> {
  if (!deps.cronSecret) return new Response("set CRON_SECRET to enable the daily refresh", { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${deps.cronSecret}`) return new Response("unauthorized", { status: 401 });
  const ready = prepare(deps);
  if ("reason" in ready) return new Response("not configured", { status: 500 });
  try {
    const { result } = await ready.refresh();
    return Response.json({ refreshed: result.kind === "subject", kind: result.kind });
  } catch (e) {
    return Response.json({ refreshed: false, error: String(e) }, { status: 502 });
  }
}

function prepare(deps: Deps): { reason: FallbackReason } | { config: CardConfig; key: string; refresh: () => Promise<RefreshOutcome>; recentlyFailed: () => boolean } {
  const parsed = parseConfig(deps.config);
  if (!parsed.ok) return { reason: { kind: "misconfigured", detail: `card.config.json: ${parsed.reason}` } };
  const { config } = parsed;
  if (!deps.token && !deps.gql) return { reason: { kind: "misconfigured", detail: "GITHUB_TOKEN is not set in the Vercel project" } };
  const token = deps.token ?? "";
  const key = storageKey(config, token);
  const gql = deps.gql ?? createGraphQL(token);
  const state = deps.refreshes ?? instanceRefreshes;
  /** Fetches from GitHub and stores the answer; a failure leaves stored data untouched. */
  const fetchAndStore = async (): Promise<RefreshOutcome> => {
    const result = await fetchActivity(gql, config.username, deps.now(), { private: config.private, log: deps.log });
    if (result.kind !== "subject") return { result };
    const storedAt = deps.now().toISOString();
    let stored: Stored = { version: 1, key, activity: result.activity, storedAt };
    if (result.activity.complete === false) {
      // An incomplete refresh never replaces complete stored data; only the refresh time moves on.
      const previous = await readStored(deps.store, key);
      if (previous && previous.activity.complete !== false) stored = { ...previous, storedAt };
    }
    // A failed write must not throw away what GitHub just answered: this request still gets its Card.
    await deps.store.set(key, stored).catch((e) => deps.log?.(`storing the Activity failed: ${e}`));
    return { result, stored };
  };
  /** One refresh per key at a time; a failure is remembered so stale data is not retried on every request. */
  const refresh = () => {
    let running = state.inFlight.get(key);
    if (!running) {
      running = fetchAndStore()
        .then(
          (outcome) => {
            state.failedAt.delete(key);
            return outcome;
          },
          (e: unknown) => {
            state.failedAt.set(key, deps.now().getTime());
            throw e;
          },
        )
        .finally(() => state.inFlight.delete(key));
      state.inFlight.set(key, running);
    }
    return running;
  };
  const recentlyFailed = () => deps.now().getTime() - (state.failedAt.get(key) ?? -Infinity) < RETRY_AFTER_MS;
  return { config, key, refresh, recentlyFailed };
}

function githubReason(e: unknown): FallbackReason {
  if (e instanceof GitHubError && e.kind === "rate-limited") return { kind: "rate-limited" };
  if (e instanceof GitHubError && e.kind === "unauthorized") return { kind: "misconfigured", detail: "GitHub rejected GITHUB_TOKEN; it may have expired" };
  return { kind: "unreachable" };
}

const card = (stored: Stored, config: CardConfig, options: RenderOptions) => svg(renderCard(stored.activity, config, options), CARD_CACHE);

const svg = (body: string, cache: string) =>
  new Response(body, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": cache } });

/** URL parameters: `theme=light|dark` (default: follow prefers-color-scheme) and `animate=false`. */
export function optionsOf(url: URL): RenderOptions {
  const theme = url.searchParams.get("theme");
  return { theme: theme === "light" || theme === "dark" ? theme : "auto", animate: url.searchParams.get("animate") !== "false" };
}
