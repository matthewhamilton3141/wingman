"use client";
import type { Activity } from "@/lib/types";
import { timeAgo } from "@/lib/api";

const agentLabel: Record<Activity["agent"], { name: string; tone: string }> = {
  scout: { name: "Scout", tone: "bg-amber-soft text-amber" },
  chat: { name: "Chat", tone: "bg-rose-soft text-rose" },
  persona: { name: "Match", tone: "bg-slate-soft text-ink-2" },
  system: { name: "System", tone: "bg-slate-soft text-ink-3" },
};

export function ActivityFeed({ activity, onOpen, compact = false }: { activity: Activity[]; onOpen: (matchId: string) => void; compact?: boolean }) {
  if (!activity.length) return <p className="text-xs text-ink-3">Nothing has happened yet. Run a cycle.</p>;
  return (
    <ol className={`space-y-${compact ? "1.5" : "2"}`}>
      {activity.slice(0, compact ? 12 : 300).map((a) => {
        const l = agentLabel[a.agent];
        return (
          <li key={a.id} className="flex gap-2 text-xs items-start">
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-medium ${l.tone}`}>{l.name}</span>
            <button
              className={`text-left flex-1 min-w-0 ${a.matchId ? "hover:underline" : ""} ${compact ? "truncate" : ""}`}
              onClick={() => a.matchId && onOpen(a.matchId)}
              disabled={!a.matchId}
            >
              {a.text}
            </button>
            <span className="shrink-0 text-ink-3 tabular-nums">{timeAgo(a.at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
