// Records a public GitHub fixture for tests: the GraphQL responses fetchActivity sees.
// Private repositories are removed before anything is written.
// Usage: GITHUB_TOKEN=… npx tsx scripts/record-fixture.ts <login> <out.json>
import { writeFileSync } from "node:fs";
import { fetchActivity } from "../src/github/contributions.js";
import { createGraphQL, type GraphQL } from "../src/github/graphql.js";

const [login, out] = process.argv.slice(2);
if (!login || !out || !process.env.GITHUB_TOKEN) throw new Error("usage: GITHUB_TOKEN=… tsx scripts/record-fixture.ts <login> <out.json>");
const real = createGraphQL(process.env.GITHUB_TOKEN);
const calls: { variables: Record<string, unknown>; data: any }[] = [];
const recording: GraphQL = async (query, variables = {}) => {
  const data = await real(query, variables);
  const list = data?.user?.contributionsCollection?.commitContributionsByRepository;
  if (list) data.user.contributionsCollection.commitContributionsByRepository = list.filter((e: any) => !e.repository.isPrivate);
  calls.push({ variables, data });
  return data;
};
const now = new Date();
await fetchActivity(recording, login, now);
writeFileSync(out, JSON.stringify({ recordedAt: now.toISOString(), login, calls }, null, 1) + "\n");
console.log(`recorded ${calls.length} calls to ${out}`);
