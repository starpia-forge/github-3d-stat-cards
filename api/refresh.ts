import { handleRefresh } from "../src/handler.js";
import { vercelDeps } from "../src/vercel.js";

/** Called once a day by Vercel Cron (see vercel.json). Vercel sends CRON_SECRET as a bearer token when it is set. */
export function GET(request: Request): Promise<Response> {
  return handleRefresh(request, { ...vercelDeps(), cronSecret: process.env.CRON_SECRET });
}
