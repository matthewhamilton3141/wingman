"use client";
import type { Match, PublicCandidate, Scored } from "@/lib/types";
import { Avatar, Button, Chips, ScorePill } from "./ui";

export function Discovery({
  candidates,
  scored,
  matches,
  busy,
  onAct,
}: {
  candidates: PublicCandidate[];
  scored: Record<string, Scored>;
  matches: Match[];
  busy: boolean;
  onAct: (id: string, action: "like" | "pass") => void;
}) {
  const rows = [...candidates].sort((a, b) => (scored[b.id]?.score ?? -1) - (scored[a.id]?.score ?? -1));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((c) => {
        const s = scored[c.id];
        const matched = matches.some((m) => m.candidateId === c.id);
        return (
          <article key={c.id} className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={c.name} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}, {c.age}</span>
                  {s && <ScorePill score={s.score} />}
                </div>
                <div className="text-xs text-ink-3">{c.job} · {c.location ?? `${c.distanceKm} km`}</div>
              </div>
              {matched ? (
                <span className="text-xs font-medium text-mint">Matched</span>
              ) : s ? (
                <span className={`text-xs font-medium ${s.decision === "like" ? "text-rose" : "text-ink-3"}`}>{s.decision === "like" ? "Liked" : "Passed"}</span>
              ) : (
                <span className="text-xs text-ink-3">Not reviewed</span>
              )}
            </div>
            <p className="text-sm">{c.bio}</p>
            <Chips items={c.interests} />
            {s ? (
              <div className="text-xs space-y-1.5 border-t border-line pt-3">
                {s.reasons.map((r) => <p key={r} className="flex gap-1.5"><span className="text-mint">+</span><span>{r}</span></p>)}
                {s.concerns.map((r) => <p key={r} className="flex gap-1.5"><span className="text-rose">–</span><span>{r}</span></p>)}
              </div>
            ) : (
              <p className="text-xs text-ink-3 border-t border-line pt-3">The scout reads this profile on the next cycle.</p>
            )}
            {s && !matched && (
              <div className="flex gap-2 mt-auto">
                {s.decision === "pass" && <Button variant="primary" disabled={busy} onClick={() => onAct(c.id, "like")}>Like anyway</Button>}
                {s.decision === "like" && <Button disabled={busy} onClick={() => onAct(c.id, "pass")}>Pass instead</Button>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
