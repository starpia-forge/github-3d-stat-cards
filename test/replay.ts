import type { GraphQL } from "../src/github/graphql.js";

export interface Recording {
  recordedAt: string;
  login: string;
  calls: { variables: Record<string, unknown>; data: any }[];
}

/**
 * A fake GitHub that answers each query with the recorded response for the same variables. A
 * window that ended at the recording time ("today") follows the clock, so its `to` may differ.
 */
export function replay(rec: Recording): GraphQL {
  const same = (recorded: Record<string, unknown>, asked: Record<string, unknown>) => {
    if (JSON.stringify(recorded) === JSON.stringify(asked)) return true;
    return recorded.to === rec.recordedAt && JSON.stringify({ ...recorded, to: 0 }) === JSON.stringify({ ...asked, to: 0 });
  };
  return async (_query, variables = {}) => {
    const hit = rec.calls.find((c) => same(c.variables, variables));
    if (!hit) throw new Error(`no recorded response for ${JSON.stringify(variables)}`);
    return structuredClone(hit.data);
  };
}
