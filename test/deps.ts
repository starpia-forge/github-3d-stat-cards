import type { Deps } from "../src/handler.js";
import { MemoryStore } from "../src/store.js";
import fixture from "./fixtures/public-activity.json" with { type: "json" };
import { replay, type Recording } from "./replay.js";

export const rec = fixture as Recording;

/** Endpoint dependencies over the recorded fixture: a fake clock, an empty in-memory store, a replaying GitHub. */
export function fixtureDeps(overrides: Partial<Deps> = {}): Deps & { store: MemoryStore; background: Promise<unknown>[] } {
  const background: Promise<unknown>[] = [];
  return {
    config: { username: rec.login },
    token: "t",
    now: () => new Date(rec.recordedAt),
    gql: replay(rec),
    store: new MemoryStore(),
    waitUntil: (p) => void background.push(p),
    background,
    ...overrides,
  } as Deps & { store: MemoryStore; background: Promise<unknown>[] };
}
