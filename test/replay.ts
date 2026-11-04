import type { GraphQL } from "../src/github/graphql.js";

export interface Recording {
  recordedAt: string;
  login: string;
  calls: { variables: Record<string, unknown>; data: any }[];
}

/** A fake GitHub that answers each query with the recorded response for the same variables. */
export function replay(rec: Recording): GraphQL {
  return async (_query, variables = {}) => {
    const hit = rec.calls.find((c) => JSON.stringify(c.variables) === JSON.stringify(variables));
    if (!hit) throw new Error(`no recorded response for ${JSON.stringify(variables)}`);
    return structuredClone(hit.data);
  };
}
