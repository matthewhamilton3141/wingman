import type { PublicState } from "./types";

async function j<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  state: () => j<PublicState>(fetch("/api/state", { cache: "no-store" })),
  cycle: () => j<{ skipped: boolean; state: PublicState }>(fetch("/api/cycle", { method: "POST" })),
  mode: (mode: "approve" | "autopilot") =>
    j<PublicState>(fetch("/api/mode", { method: "PUT", body: JSON.stringify({ mode }) })),
  send: (id: string, text?: string) =>
    j<PublicState>(fetch(`/api/matches/${id}`, { method: "POST", body: JSON.stringify({ action: "send", text }) })),
  discard: (id: string) =>
    j<PublicState>(fetch(`/api/matches/${id}`, { method: "POST", body: JSON.stringify({ action: "discard" }) })),
  patch: (id: string, body: { stage?: string; notes?: string }) =>
    j<PublicState>(fetch(`/api/matches/${id}`, { method: "PATCH", body: JSON.stringify(body) })),
  candidate: (id: string, action: "like" | "pass") =>
    j<PublicState>(fetch(`/api/candidates/${id}`, { method: "POST", body: JSON.stringify({ action }) })),
  prefs: (body: object) => j<PublicState>(fetch("/api/preferences", { method: "PUT", body: JSON.stringify(body) })),
  reset: () => j<PublicState>(fetch("/api/reset", { method: "POST" })),
};

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
