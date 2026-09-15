"use client";
import type { Match, PublicCandidate, Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { timeAgo } from "@/lib/api";
import { Avatar, ScorePill, sentimentTone } from "./ui";

const VISIBLE: Stage[] = ["new", "chatting", "warm", "date_proposed", "date_set", "cold"];

export function Pipeline({
  matches,
  candidates,
  selected,
  onSelect,
  onMove,
}: {
  matches: Match[];
  candidates: PublicCandidate[];
  selected?: string;
  onSelect: (id: string) => void;
  onMove: (id: string, stage: Stage) => void;
}) {
  const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
  return (
    <div className="flex gap-4 overflow-x-auto thin-scroll pb-2 h-full">
      {VISIBLE.map((stage) => {
        const label = STAGES.find((s) => s.id === stage)!.label;
        const col = matches.filter((m) => m.stage === stage);
        return (
          <section
            key={stage}
            className="w-[200px] shrink-0 flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/match");
              if (id) onMove(id, stage);
            }}
          >
            <header className="flex items-baseline justify-between px-1 pb-2">
              <h2 className="font-semibold">{label}</h2>
              <span className="text-xs text-ink-3 tabular-nums">{col.length}</span>
            </header>
            <div className="flex flex-col gap-2 min-h-[120px] rounded-xl bg-[rgba(255,255,255,.35)] p-1.5 flex-1">
              {col.length === 0 && <p className="text-xs text-ink-3 px-2 py-3">Nothing here yet.</p>}
              {col.map((m) => {
                const c = byId[m.candidateId];
                const last = m.messages[m.messages.length - 1];
                const isSel = m.id === selected;
                return (
                  <button
                    key={m.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/match", m.id)}
                    onClick={() => onSelect(m.id)}
                    className={`text-left rounded-xl bg-surface border p-3 transition-colors ${isSel ? "border-ink" : "border-line hover:border-ink-3"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c?.name ?? "?"} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{c?.name}, {c?.age}</span>
                          <ScorePill score={m.crm.compatibility || m.score} />
                        </div>
                        <div className="text-xs text-ink-3 truncate">{c?.job}</div>
                      </div>
                    </div>
                    {last && (
                      <p className="mt-2 text-xs text-ink-2 line-clamp-2">
                        <span className="text-ink-3">{last.from === "user" ? "You: " : ""}</span>
                        {last.text}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`rounded-md px-1.5 py-0.5 ${sentimentTone[m.crm.sentiment]}`}>{m.crm.sentiment}</span>
                      {m.draft ? (
                        <span className="text-rose font-medium">Draft ready</span>
                      ) : (
                        <span className="text-ink-3">{timeAgo(m.updatedAt)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
