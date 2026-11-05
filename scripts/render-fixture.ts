// Renders the recorded fixture through the endpoint into a folder, with a page that shows each
// Card as an external <img> (the way GitHub embeds it) on light and dark README backgrounds.
// Usage: npx tsx scripts/render-fixture.ts <out-dir> [fixture.json]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleMilkyWay } from "../src/handler.js";
import { MemoryStore } from "../src/store.js";
import { replay, type Recording } from "../test/replay.js";

const [out, file = "test/fixtures/public-activity.json"] = process.argv.slice(2);
if (!out) throw new Error("usage: tsx scripts/render-fixture.ts <out-dir> [fixture.json]");
const rec = JSON.parse(readFileSync(file, "utf8")) as Recording;
mkdirSync(out, { recursive: true });
const variants = ["theme=light", "theme=dark", "", "theme=light&animate=false", "theme=dark&animate=false"];
const rows: string[] = [];
for (const q of variants) {
  const res = await handleMilkyWay(new Request(`https://card.example/api/milky-way?${q}`), {
    config: { username: rec.login },
    token: "t",
    now: () => new Date(rec.recordedAt),
    gql: replay(rec),
    store: new MemoryStore(),
    waitUntil: () => {},
  });
  const body = await res.text();
  const name = `card-${q.replace(/[=&]/g, "-") || "auto"}.svg`;
  writeFileSync(join(out, name), body);
  const bg = q.includes("dark") ? "dark" : "light";
  rows.push(`<figure class="${bg}"><img src="${name}" alt=""><figcaption>${q || "auto"} · ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB</figcaption></figure>`);
  console.log(`${name}  ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
}
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Card preview</title><style>
body{margin:0;font:13px system-ui;background:#888}figure{margin:0;padding:16px;max-width:846px}
.light{background:#fff;color:#1f2328}.dark{background:#0d1117;color:#e6edf3}img{display:block;width:100%}
@media (prefers-color-scheme:dark){figure:nth-child(3){background:#0d1117;color:#e6edf3}}</style>${rows.join("")}`,
);
