import { createHash } from "node:crypto";
import type { Activity } from "./activity.js";
import type { CardConfig } from "./config.js";

/** Where per-repository data is kept between requests (Vercel Runtime Cache in production). */
export interface Store {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

/** What is stored: the Activity and when it was fetched. */
export interface Stored {
  version: 1;
  key: string;
  activity: Activity;
  storedAt: string;
  /** False when GitHub's limits left a gap in the history. */
  complete: boolean;
}

/** Stored data older than this is served as is and refreshed in the background. */
export const STALE_AFTER_MS = 12 * 3_600_000;

/**
 * The storage key: the Subject, the `private` level and the token. Changing any of them reaches
 * different stored data, so data fetched under another config or token is never served. The
 * token appears only as a truncated hash.
 */
export function storageKey(config: CardConfig, token: string): string {
  const tokenId = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `milky-way:v1:${config.username.toLowerCase()}:${config.private}:${tokenId}`;
}

/** Reads stored data, rejecting anything written under a different key or in an unknown shape. */
export async function readStored(store: Store, key: string): Promise<Stored | undefined> {
  const value = (await store.get(key).catch(() => null)) as Partial<Stored> | null;
  if (!value || value.version !== 1 || value.key !== key || !value.activity || !Array.isArray(value.activity.repos)) return undefined;
  return value as Stored;
}

export const isStale = (s: Stored, now: Date): boolean => now.getTime() - Date.parse(s.storedAt) > STALE_AFTER_MS;

/** An in-memory Store, for tests and local runs. */
export class MemoryStore implements Store {
  readonly data = new Map<string, unknown>();
  async get(key: string) {
    return this.data.has(key) ? structuredClone(this.data.get(key)) : null;
  }
  async set(key: string, value: unknown) {
    this.data.set(key, structuredClone(value));
  }
}
