import fs from "node:fs";
import path from "node:path";
import type { Activity, AgentName, PublicState, State } from "./types";
import { seedCandidates, seedPreferences, seedUser } from "./seed";

import { backend } from "./claude";

const platformName = () => (process.env.PLATFORM?.toLowerCase() === "hinge" ? "Hinge" : "SimDate") as State["platform"];

const DB_PATH = path.join(process.cwd(), "data", "db.json");

function fresh(): State {
  return {
    user: seedUser,
    preferences: seedPreferences,
    mode: "approve",
    candidates: seedCandidates,
    scored: {},
    matches: [],
    activity: [],
    running: false,
    llm: backend(),
    platform: platformName(),
  };
}

// Survive Next dev HMR by hanging the cache off globalThis.
const g = globalThis as unknown as { __wingmanDb?: State };

export function getState(): State {
  if (g.__wingmanDb) return g.__wingmanDb;
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as State;
    parsed.running = false;
    parsed.llm = backend();
    parsed.platform = platformName();
    g.__wingmanDb = parsed;
  } catch {
    g.__wingmanDb = fresh();
    save();
  }
  return g.__wingmanDb!;
}

export function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(g.__wingmanDb, null, 2));
}

export function reset() {
  g.__wingmanDb = fresh();
  save();
}

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

export function now() {
  return new Date().toISOString();
}

export function log(agent: AgentName, text: string, ids: { matchId?: string; candidateId?: string } = {}) {
  const s = getState();
  const a: Activity = { id: uid("a_"), at: now(), agent, text, ...ids };
  s.activity.unshift(a);
  if (s.activity.length > 300) s.activity.length = 300;
  return a;
}

export function publicState(): PublicState {
  const s = getState();
  return {
    ...s,
    candidates: s.candidates.map((c) => {
      const { persona, ...rest } = c;
      void persona;
      return rest;
    }),
  };
}
