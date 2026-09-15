// Hinge sidecar: HTTP bridge between Wingman and the Hinge app on the mirrored
// iPhone. Run with `npm run sidecar` (Node 24 strips the types itself).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hinge } from "./hinge.ts";
import * as phone from "./phone.ts";
import { hasClaude } from "./vision.ts";

// Load .env from the project root so the sidecar shares the app's API key.
for (const file of [".env.local", ".env"]) {
  const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = Number(process.env.SIDECAR_PORT ?? 4747);
const hinge = new Hinge();
const startedAt = new Date().toISOString();
const recent: string[] = [];
hinge.log = (m) => {
  console.log(`[hinge] ${m}`);
  recent.unshift(`${new Date().toLocaleTimeString()} ${m}`);
  if (recent.length > 40) recent.length = 40;
};

type Handler = (body: Record<string, unknown>) => Promise<unknown>;

const routes: Record<string, Handler> = {
  "POST /discover": async () => ({ candidate: await hinge.readProfile() }),
  "POST /like": async (b) => hinge.like(String(b.candidateId), typeof b.comment === "string" && b.comment ? b.comment : undefined),
  "POST /pass": async (b) => {
    await hinge.pass(String(b.candidateId));
    return { ok: true };
  },
  "POST /matches": async () => ({ matches: await hinge.listMatches() }),
  "POST /thread": async (b) => hinge.readThread(String(b.name)),
  "POST /send": async (b) => {
    await hinge.send(String(b.name), String(b.text));
    return { ok: true };
  },
  "GET /inspect": async () => {
    const { info } = await hinge.run("inspect", () => hinge.inspect());
    return info;
  },
  // Debug hooks: coordinates are image pixels, same space the vision model uses.
  "POST /tap": async (b) => {
    await hinge.tapAt(Number(b.x), Number(b.y));
    return { ok: true };
  },
  "POST /scroll": async (b) => {
    await hinge.scroll(Number(b.fraction ?? 0.8));
    return { ok: true };
  },
  "POST /type": async (b) => {
    await hinge.typeText(String(b.text));
    return { ok: true };
  },
};

async function health() {
  const win = await phone.window();
  let screenshot: string | true = true;
  if (win) {
    try {
      await phone.screenshot();
    } catch (e) {
      screenshot = (e as Error).message;
    }
  }
  return {
    ok: !!win && screenshot === true && hasClaude(),
    platform: "Hinge",
    startedAt,
    window: win,
    screenshot,
    llm: hasClaude(),
    busy: hinge.busy,
    current: hinge.current ? { id: hinge.current.id, name: hinge.current.name } : null,
    last: hinge.last ?? null,
    recent,
  };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const key = `${req.method} ${(req.url ?? "/").split("?")[0]}`;
  try {
    if (key === "GET /health" || key === "GET /") return json(res, 200, await health());
    if (key === "GET /screen.png") {
      const f = await phone.screenshot();
      res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store", "access-control-allow-origin": "*" });
      return res.end(f.png);
    }
    const h = routes[key];
    if (!h) return json(res, 404, { error: `no route ${key}` });
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    json(res, 200, await h(body));
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[sidecar] ${key} failed: ${msg}`);
    json(res, 500, { error: msg });
  }
});

server.listen(PORT, "127.0.0.1", async () => {
  const h = await health();
  console.log(`Hinge sidecar on http://127.0.0.1:${PORT}`);
  console.log(`  iPhone Mirroring window: ${h.window ? `${h.window.w}×${h.window.h} at ${h.window.x},${h.window.y}` : "NOT FOUND (open iPhone Mirroring)"}`);
  console.log(`  screenshot: ${h.screenshot === true ? "ok" : h.screenshot}`);
  console.log(`  claude: ${h.llm ? "ok" : "ANTHROPIC_API_KEY missing"}`);
});
