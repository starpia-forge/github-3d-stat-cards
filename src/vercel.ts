import { getCache, waitUntil } from "@vercel/functions";
import config from "../card.config.json" with { type: "json" };
import type { Deps } from "./handler.js";
import type { Store } from "./store.js";

/** Stored data outlives the 12 h staleness window comfortably; refreshes overwrite it. */
const TTL_SECONDS = 30 * 24 * 3600;

/** Vercel Runtime Cache as the Store: needs no setup in a fork. */
function runtimeStore(): Store {
  const cache = getCache({ namespace: "github-milkyway-stat-cards" });
  return {
    get: (key) => cache.get(key),
    set: (key, value) => cache.set(key, value, { ttl: TTL_SECONDS, name: "milky-way" }),
  };
}

/** Production wiring for the Vercel Functions. */
export function vercelDeps(): Deps {
  return {
    config,
    token: process.env.GITHUB_TOKEN,
    now: () => new Date(),
    store: runtimeStore(),
    waitUntil: (work) => void waitUntil(work),
    log: (m) => console.log(m),
  };
}
