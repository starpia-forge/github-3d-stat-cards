import type { GraphQL } from "../src/github/graphql.js";

export interface Recording {
  recordedAt: string;
  login: string;
  calls: { variables: Record<string, unknown>; data: any }[];
}

/**
 * A fake GitHub that answers each query with the recorded response for the same variables. The
 * end of the current year's window follows the clock, so `to` is not compared.
 */
export function replay(rec: Recording): GraphQL {
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify({ ...a, to: 0 }) === JSON.stringify({ ...b, to: 0 });
  return async (_query, variables = {}) => {
    const hit = rec.calls.find((c) => same(c.variables, variables));
    if (!hit) throw new Error(`no recorded response for ${JSON.stringify(variables)}`);
    return structuredClone(hit.data);
  };
}
