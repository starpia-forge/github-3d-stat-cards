import config from "../card.config.json" with { type: "json" };
import { handleMilkyWay } from "../src/handler.js";

export function GET(request: Request): Promise<Response> {
  return handleMilkyWay(request, { config, token: process.env.GITHUB_TOKEN, now: () => new Date() });
}
