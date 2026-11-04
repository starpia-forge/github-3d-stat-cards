/** The Host's `card.config.json`, validated. */
export type PrivateLevel = "off" | "owned" | "all";

export interface CardConfig {
  username: string;
  displayName: string | undefined;
  hide: string[];
  private: PrivateLevel;
}

export type ConfigResult = { ok: true; config: CardConfig } | { ok: false; reason: string };

/** GitHub logins: alphanumerics and single inner hyphens, at most 39 characters. */
const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const LEVELS: readonly PrivateLevel[] = ["off", "owned", "all"];

export function parseConfig(raw: unknown): ConfigResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("config is not an object");
  const r = raw as Record<string, unknown>;
  if (typeof r.username !== "string" || r.username === "") return fail("username is required");
  if (!LOGIN.test(r.username)) return fail("username is not a valid GitHub login");
  if (r.displayName !== undefined && typeof r.displayName !== "string") return fail("displayName must be text");
  const hide = r.hide ?? [];
  if (!Array.isArray(hide) || !hide.every((h) => typeof h === "string")) return fail("hide must be a list of Language names");
  const level = r.private ?? "off";
  if (!LEVELS.includes(level as PrivateLevel)) return fail("private must be off, owned or all");
  return {
    ok: true,
    config: { username: r.username, displayName: r.displayName === "" ? undefined : r.displayName, hide, private: level as PrivateLevel },
  };
}

const fail = (reason: string): ConfigResult => ({ ok: false, reason });
