import { handleMilkyWay } from "../src/handler.js";
import { vercelDeps } from "../src/vercel.js";

export function GET(request: Request): Promise<Response> {
  return handleMilkyWay(request, vercelDeps());
}
