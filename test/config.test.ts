import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("accepts a minimal config and fills defaults", () => {
    expect(parseConfig({ username: "octocat" })).toEqual({
      ok: true,
      config: { username: "octocat", displayName: undefined, hide: [], private: "off" },
    });
  });

  it("keeps optional fields", () => {
    const r = parseConfig({ username: "a-b", displayName: "Ann", hide: ["HTML"], private: "owned" });
    expect(r).toEqual({ ok: true, config: { username: "a-b", displayName: "Ann", hide: ["HTML"], private: "owned" } });
  });

  it.each([
    [undefined, "config is not an object"],
    [{}, "username is required"],
    [{ username: "" }, "username is required"],
    [{ username: "-bad" }, "username is not a valid GitHub login"],
    [{ username: "a--b" }, "username is not a valid GitHub login"],
    [{ username: "x".repeat(40) }, "username is not a valid GitHub login"],
    [{ username: "ok", hide: "HTML" }, "hide must be a list of Language names"],
    [{ username: "ok", private: "yes" }, "private must be off, owned or all"],
    [{ username: "ok", displayName: 3 }, "displayName must be text"],
  ])("rejects %j", (raw, reason) => {
    expect(parseConfig(raw)).toEqual({ ok: false, reason });
  });
});
