import { uid } from "../db";
import type { Candidate } from "../types";
import type { DatingPlatform } from "./types";

/**
 * Hinge, via the sidecar (see /sidecar): a local process that screenshots the
 * iPhone Mirroring window, reads it with Claude vision, and taps/types into it.
 */
export const SIDECAR_URL = process.env.SIDECAR_URL ?? "http://127.0.0.1:4747";

async function call<T>(route: string, body?: object, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SIDECAR_URL}${route}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(240_000),
    });
  } catch (e) {
    throw new Error(`Hinge sidecar unreachable at ${SIDECAR_URL} (${(e as Error).message}). Start it with \`npm run sidecar\`.`);
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `sidecar ${route} failed (${res.status})`);
  return data;
}

interface SidecarCandidate {
  id: string; name: string; age: number; location: string; distanceKm: number; job: string;
  bio: string; interests: string[]; prompts: { q: string; a: string }[]; vitals: string[];
}

/** Persona is only meaningful to the simulator; real people get a neutral placeholder. */
const realPerson = { temperament: "real person", texting: "unknown", openness: 0.5 };

function toCandidate(c: SidecarCandidate): Candidate {
  const vitals = c.vitals.length ? ` ${c.vitals.join(" · ")}.` : "";
  return {
    id: c.id,
    name: c.name,
    age: c.age,
    distanceKm: c.distanceKm,
    location: c.location || undefined,
    job: c.job || "—",
    bio: `${c.bio}${vitals}`.trim(),
    interests: c.interests,
    prompts: c.prompts,
    persona: realPerson,
  };
}

/** A match that already existed on Hinge before Wingman was watching. */
export function placeholderCandidate(name: string): Candidate {
  return {
    id: uid("h_existing_"),
    name,
    age: 0,
    distanceKm: 0,
    job: "—",
    bio: `Matched on Hinge before Wingman started watching; profile details unknown. Learn about ${name} from the conversation.`,
    interests: [],
    prompts: [],
    persona: realPerson,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const sameName = (a: string, b: string) => norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a));

/** Last /matches result, so awaitReply can skip opening chats where it's still their turn. */
let lastMatches: { name: string; preview: string; yourTurn: boolean; at: number }[] = [];

export const hingePlatform: DatingPlatform = {
  name: "Hinge",

  async discover(seen) {
    const { candidate } = await call<{ candidate: SidecarCandidate }>("/discover");
    return seen.has(candidate.id) ? [] : [toCandidate(candidate)];
  },

  async like(c, comment) {
    const r = await call<{ matched: boolean }>("/like", { candidateId: c.id, comment });
    return { matched: r.matched, commented: !!comment };
  },

  async pass(c) {
    await call("/pass", { candidateId: c.id });
  },

  async matches() {
    const { matches } = await call<{ matches: { name: string; preview: string; yourTurn: boolean }[] }>("/matches");
    lastMatches = matches.map((m) => ({ ...m, at: Date.now() }));
    return matches;
  },

  async thread(c) {
    const t = await call<{ messages: { from: "user" | "match"; text: string }[] }>("/thread", { name: c.name });
    return t.messages;
  },

  async send(c, _m, text) {
    await call("/send", { name: c.name, text });
  },

  async awaitReply(_user, c, m) {
    const ours = m.messages.filter((x) => x.from === "user");
    const lastOurs = ours[ours.length - 1]?.text ?? "";
    // Cheap check first: the Matches list says whose turn it is and previews the last message.
    const row = lastMatches.find((x) => sameName(x.name, c.name) && Date.now() - x.at < 5 * 60_000);
    if (row && !row.yourTurn && lastOurs && norm(row.preview).length > 3 && norm(lastOurs).includes(norm(row.preview).slice(0, 20))) {
      return { text: "", acceptsDate: false, pending: true };
    }
    const t = await call<{ messages: { from: "user" | "match"; text: string }[]; theirTurn: boolean }>("/thread", { name: c.name });
    // New replies = trailing match messages after the last user message.
    const idx = t.messages.map((x) => x.from).lastIndexOf("user");
    const fresh = t.messages.slice(idx + 1).filter((x) => x.from === "match").map((x) => x.text);
    if (!fresh.length) return { text: "", acceptsDate: false, pending: true };
    // Skip anything we already recorded.
    const known = new Set(m.messages.filter((x) => x.from === "match").map((x) => norm(x.text)));
    const unseen = fresh.filter((x) => !known.has(norm(x)));
    if (!unseen.length) return { text: "", acceptsDate: false, pending: true };
    return { text: unseen.join("\n"), acceptsDate: false };
  },
};
