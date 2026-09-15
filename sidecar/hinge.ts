// Drives the Hinge app on the mirrored iPhone. Every public method is
// serialized through a queue: there is exactly one phone and one screen.
import * as phone from "./phone.ts";
import type { Frame } from "./phone.ts";
import { Inspect, Profile, Thread, see } from "./vision.ts";
import type { InspectResult, ProfileResult, ScreenName, ThreadResult } from "./vision.ts";

export interface SidecarCandidate {
  id: string;
  name: string;
  age: number;
  location: string;
  distanceKm: number;
  job: string;
  bio: string;
  interests: string[];
  prompts: { q: string; a: string }[];
  vitals: string[];
}

export interface Conversation { name: string; preview: string; yourTurn: boolean }

const NOISE: ScreenName[] = ["paywall", "dialog", "other", "loading"];

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const sameName = (a: string, b: string) => !!a && !!b && (norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a)));

export class Hinge {
  private queue: Promise<unknown> = Promise.resolve();
  /** The profile currently on the Discover screen, as last read. */
  current?: SidecarCandidate;
  last?: { screen: ScreenName; description: string; at: string };
  busy = false;
  log: (msg: string) => void = (m) => console.log(`[hinge] ${m}`);

  /** Serialize phone work; concurrent HTTP calls line up here. */
  run<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      this.busy = true;
      this.log(`▶ ${label}`);
      try {
        return await fn();
      } finally {
        this.busy = false;
      }
    });
    this.queue = next.catch(() => {});
    return next;
  }

  // ---- Looking -----------------------------------------------------------

  async inspect(): Promise<{ frame: Frame; info: InspectResult }> {
    const frame = await phone.screenshot();
    const info = await see({ frames: [frame.png], schema: Inspect, prompt: "Inspect this Hinge screen and locate the listed controls." });
    this.last = { screen: info.screen, description: info.description, at: new Date().toISOString() };
    return { frame, info };
  }

  private async tapTarget(frame: Frame, t: { visible: boolean; x: number; y: number }, what: string) {
    if (!t.visible) throw new Error(`${what} is not visible on screen`);
    await phone.tap(frame, t.x, t.y);
  }

  /** Get to a top-level screen, backing out of chats/sheets and dismissing dialogs on the way. */
  async ensure(target: "discover" | "matches"): Promise<{ frame: Frame; info: InspectResult }> {
    for (let i = 0; i < 5; i++) {
      const cur = await this.inspect();
      const { frame, info } = cur;
      if (info.screen === target) return cur;
      if (NOISE.includes(info.screen) || info.screen === "its_a_match") {
        if (info.dismiss.visible) await phone.tap(frame, info.dismiss.x, info.dismiss.y);
        else await phone.key("escape");
      } else if (info.screen === "like_sheet") {
        if (info.dismiss.visible) await phone.tap(frame, info.dismiss.x, info.dismiss.y);
        else await phone.swipe(frame, -0.4); // drag the sheet down
      } else if (info.screen === "chat" && info.backButton.visible) {
        await phone.tap(frame, info.backButton.x, info.backButton.y);
      } else {
        const tab = target === "discover" ? info.tabs.discover : info.tabs.matches;
        if (tab.visible) await phone.tap(frame, tab.x, tab.y);
        else if (info.backButton.visible) await phone.tap(frame, info.backButton.x, info.backButton.y);
        else await phone.key("escape");
      }
      await phone.sleep(900);
    }
    throw new Error(`Could not reach the ${target} screen (stuck on: ${this.last?.description})`);
  }

  /** Scroll through whatever is on screen, collecting frames until it stops changing. */
  private async scrollFrames(max: number, fraction: number): Promise<Frame[]> {
    const frames: Frame[] = [await phone.screenshot()];
    for (let i = 1; i < max; i++) {
      await phone.scrollBy(frames[frames.length - 1], fraction);
      await phone.sleep(650);
      const f = await phone.screenshot();
      if (phone.signature(f) === phone.signature(frames[frames.length - 1])) break;
      frames.push(f);
    }
    return frames;
  }

  private async scrollToTop(frame: Frame) {
    await phone.scrollBy(frame, -4);
    await phone.sleep(300);
    await phone.scrollBy(frame, -4);
    await phone.sleep(400);
  }

  // ---- Discover ----------------------------------------------------------

  readProfile(): Promise<SidecarCandidate> {
    return this.run("readProfile", async () => {
      const { frame } = await this.ensure("discover");
      await this.scrollToTop(frame);
      const frames = await this.scrollFrames(6, 0.85);
      const p: ProfileResult = await see({
        frames: frames.map((f) => f.png),
        schema: Profile,
        prompt: `These ${frames.length} frames are one Hinge profile, scrolled top to bottom with overlap. Extract the profile.`,
        effort: "medium",
      });
      const id = `h_${norm(p.name) || "unknown"}_${p.age || 0}_${Date.now().toString(36)}`;
      this.current = { id, name: p.name || "Unknown", age: p.age, location: p.location, distanceKm: p.distanceKm, job: p.job, bio: p.bio, interests: p.interests, prompts: p.prompts, vitals: p.vitals };
      // Leave the card at the top so the first heart is on screen for like().
      await this.scrollToTop(frames[frames.length - 1]);
      this.log(`profile: ${this.current.name}, ${this.current.age} (${frames.length} frames, ${p.prompts.length} prompts)`);
      return this.current;
    });
  }

  private assertCurrent(id: string) {
    if (!this.current || this.current.id !== id) {
      throw new Error(`Profile ${id} is not the one on screen (${this.current?.id ?? "none"}); call /discover first`);
    }
  }

  like(id: string, comment?: string): Promise<{ matched: boolean }> {
    return this.run(`like ${id}`, async () => {
      this.assertCurrent(id);
      let { frame, info } = await this.ensure("discover");
      if (!sameName(info.profileName, this.current!.name)) throw new Error(`Discover now shows ${info.profileName || "someone else"}, not ${this.current!.name}`);
      // Hearts live on each photo/prompt; scroll until one is visible.
      for (let i = 0; i < 3 && !info.likeButton.visible; i++) {
        await phone.scrollBy(frame, 0.5);
        await phone.sleep(500);
        ({ frame, info } = await this.inspect());
      }
      await this.tapTarget(frame, info.likeButton, "Like button");
      await phone.sleep(900);
      ({ frame, info } = await this.inspect());
      if (info.screen !== "like_sheet") {
        // Some builds send the like straight away when tapping a photo heart.
        this.log(`no like sheet after tapping heart (screen=${info.screen})`);
      } else {
        if (comment && info.commentField.visible) {
          await phone.tap(frame, info.commentField.x, info.commentField.y);
          await phone.sleep(500);
          await phone.type(comment);
          await phone.sleep(400);
          ({ frame, info } = await this.inspect());
        }
        await this.tapTarget(frame, info.sendLikeButton, "Send Like button");
        await phone.sleep(1500);
        ({ frame, info } = await this.inspect());
      }
      this.current = undefined;
      const matched = info.screen === "its_a_match";
      if (matched && info.dismiss.visible) await phone.tap(frame, info.dismiss.x, info.dismiss.y);
      this.log(`liked${comment ? " with comment" : ""}; matched=${matched}`);
      return { matched };
    });
  }

  pass(id: string): Promise<void> {
    return this.run(`pass ${id}`, async () => {
      this.assertCurrent(id);
      const { frame, info } = await this.ensure("discover");
      if (!sameName(info.profileName, this.current!.name)) throw new Error(`Discover now shows ${info.profileName || "someone else"}, not ${this.current!.name}`);
      await this.tapTarget(frame, info.closeButton, "Pass (X) button");
      await phone.sleep(1200);
      this.current = undefined;
    });
  }

  // ---- Matches -----------------------------------------------------------

  listMatches(): Promise<Conversation[]> {
    return this.run("listMatches", async () => {
      const { frame, info } = await this.ensure("matches");
      await this.scrollToTop(frame);
      const seen = new Map<string, Conversation>();
      let cur = info;
      let f = frame;
      for (let i = 0; i < 3; i++) {
        for (const c of cur.conversations) if (!seen.has(norm(c.name))) seen.set(norm(c.name), { name: c.name, preview: c.preview, yourTurn: c.yourTurn });
        if (cur.conversations.length === 0) break;
        await phone.scrollBy(f, 0.8);
        await phone.sleep(600);
        const next = await this.inspect();
        if (next.info.conversations.every((c) => seen.has(norm(c.name)))) break;
        cur = next.info;
        f = next.frame;
      }
      await this.scrollToTop(f);
      return [...seen.values()];
    });
  }

  private async openChat(name: string): Promise<{ frame: Frame; info: InspectResult }> {
    let { frame, info } = await this.ensure("matches");
    await this.scrollToTop(frame);
    ({ frame, info } = await this.inspect());
    let row = info.conversations.find((c) => sameName(c.name, name));
    for (let i = 0; i < 3 && !row; i++) {
      await phone.scrollBy(frame, 0.8);
      await phone.sleep(600);
      ({ frame, info } = await this.inspect());
      row = info.conversations.find((c) => sameName(c.name, name));
    }
    if (!row) throw new Error(`No conversation with ${name} in Matches`);
    await phone.tap(frame, row.x, row.y);
    await phone.sleep(1200);
    const opened = await this.inspect();
    if (opened.info.screen !== "chat") throw new Error(`Tapped ${name} but landed on ${opened.info.screen}`);
    if (opened.info.profileName && !sameName(opened.info.profileName, name)) throw new Error(`Opened a chat with ${opened.info.profileName}, expected ${name}`);
    return opened;
  }

  readThread(name: string): Promise<ThreadResult> {
    return this.run(`readThread ${name}`, async () => {
      const { frame } = await this.openChat(name);
      // Newest messages are at the bottom; grab one screen of history above too.
      const bottom = frame;
      await phone.scrollBy(frame, -0.8);
      await phone.sleep(600);
      const above = await phone.screenshot();
      const frames = phone.signature(above) === phone.signature(bottom) ? [bottom] : [above, bottom];
      const t = await see({
        frames: frames.map((f) => f.png),
        schema: Thread,
        prompt: `These ${frames.length} frames show a Hinge chat (earlier history first, most recent last). Transcribe the messages.`,
        effort: "medium",
      });
      this.log(`thread with ${name}: ${t.messages.length} messages, theirTurn=${t.theirTurn}`);
      await this.back();
      return t;
    });
  }

  send(name: string, text: string): Promise<void> {
    return this.run(`send → ${name}`, async () => {
      let { frame, info } = await this.openChat(name);
      await this.tapTarget(frame, info.messageField, "Message field");
      await phone.sleep(600);
      await phone.type(text);
      await phone.sleep(500);
      ({ frame, info } = await this.inspect());
      if (info.sendButton.visible) await phone.tap(frame, info.sendButton.x, info.sendButton.y);
      else await phone.key("return");
      await phone.sleep(1000);
      this.log(`sent to ${name}: "${text.slice(0, 60)}"`);
      await this.back();
    });
  }

  private async back() {
    const { frame, info } = await this.inspect();
    if (info.backButton.visible) await phone.tap(frame, info.backButton.x, info.backButton.y);
    else if (info.tabs.matches.visible) await phone.tap(frame, info.tabs.matches.x, info.tabs.matches.y);
    await phone.sleep(600);
  }

  // ---- Debug -------------------------------------------------------------

  tapAt(x: number, y: number) {
    return this.run(`tap ${x},${y}`, async () => phone.tap(await phone.screenshot(), x, y));
  }
  scroll(fraction: number) {
    return this.run(`scroll ${fraction}`, async () => phone.scrollBy(await phone.screenshot(), fraction));
  }
  typeText(text: string) {
    return this.run("type", () => phone.type(text));
  }
}
