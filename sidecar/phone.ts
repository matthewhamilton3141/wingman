// Talks to the iPhone Mirroring window: screenshots via `screencapture`,
// input via the Swift helper in native.swift (compiled on first use).
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "native.swift");
const BIN = path.join(here, "native");

export interface WindowRect { id: number; x: number; y: number; w: number; h: number }

export interface Frame {
  png: Buffer;
  width: number;
  height: number;
  window: WindowRect;
}

let building: Promise<void> | undefined;
function ensureBuilt() {
  const stale = !fs.existsSync(BIN) || fs.statSync(BIN).mtimeMs < fs.statSync(SRC).mtimeMs;
  if (!stale) return Promise.resolve();
  // Memoized so concurrent callers share one swiftc instead of racing on the binary.
  building ??= (async () => {
    console.log("[phone] compiling native.swift…");
    try {
      await run("swiftc", ["-O", SRC, "-o", BIN]);
    } finally {
      building = undefined;
    }
  })();
  return building;
}

async function native(...args: string[]): Promise<string> {
  await ensureBuilt();
  try {
    const { stdout } = await run(BIN, args);
    return stdout.trim();
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`native ${args[0]}: ${(err.stderr || err.message).trim()}`);
  }
}

export async function window(): Promise<WindowRect | null> {
  try {
    return JSON.parse(await native("window")) as WindowRect;
  } catch (e) {
    const msg = (e as Error).message;
    // "not found" is the normal offline state; anything else is worth seeing.
    if (!/not found/.test(msg)) console.error(`[phone] ${msg}`);
    return null;
  }
}

export async function focus() {
  await native("focus");
}

function pngSize(buf: Buffer) {
  // IHDR is always the first chunk: width at byte 16, height at byte 20.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Capture the mirroring window. Throws if the window is missing or capture is blocked. */
export async function screenshot(): Promise<Frame> {
  const w = await window();
  if (!w) throw new Error("iPhone Mirroring window not found. Open iPhone Mirroring and unlock the phone.");
  const file = path.join(os.tmpdir(), `wingman-shot-${process.pid}.png`);
  try {
    // -x silent, -o no shadow (so the image maps 1:1 onto the window bounds), -l window id
    await run("screencapture", ["-x", "-o", "-l", String(w.id), file]);
  } catch (e) {
    throw new Error(
      `screencapture failed (${(e as Error).message.trim()}). Grant Screen Recording to your terminal in System Settings → Privacy & Security.`,
    );
  }
  const png = fs.readFileSync(file);
  fs.rmSync(file, { force: true });
  return { png, ...pngSize(png), window: w };
}

/** Convert image-pixel coordinates (what the vision model sees) to screen points. */
export function toScreen(f: Frame, px: number, py: number) {
  return {
    x: f.window.x + (px / f.width) * f.window.w,
    y: f.window.y + (py / f.height) * f.window.h,
  };
}

export async function tap(f: Frame, px: number, py: number) {
  const p = toScreen(f, px, py);
  await native("click", p.x.toFixed(1), p.y.toFixed(1));
}

/** Scroll the content by roughly `fraction` of the window height (positive = scroll down / content moves up). */
export async function scrollBy(f: Frame, fraction: number) {
  const cx = f.window.x + f.window.w / 2;
  const cy = f.window.y + f.window.h * 0.5;
  await native("scroll", cx.toFixed(1), cy.toFixed(1), (f.window.h * fraction).toFixed(0));
}

/** Touch-drag vertically, for lists that ignore wheel events. */
export async function swipe(f: Frame, fraction: number) {
  const cx = f.window.x + f.window.w / 2;
  const from = f.window.y + f.window.h * (fraction > 0 ? 0.75 : 0.3);
  const to = from - f.window.h * fraction;
  await native("swipe", cx.toFixed(1), from.toFixed(1), cx.toFixed(1), to.toFixed(1), "400");
}

export async function type(text: string) {
  await native("type", text);
}

export async function key(name: "return" | "delete" | "escape" | "tab") {
  await native("key", name);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cheap "did the screen change" check: compare a sampled byte signature. */
export function signature(f: Frame) {
  const step = Math.max(1, Math.floor(f.png.length / 4096));
  let h = 0;
  for (let i = 0; i < f.png.length; i += step) h = (h * 31 + f.png[i]) >>> 0;
  return h;
}
