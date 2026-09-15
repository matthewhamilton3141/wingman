"use client";
import { useState } from "react";
import type { Match, PublicCandidate, Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { Avatar, Button, Chips, ScorePill, sentimentTone } from "./ui";

export function MatchDetail({
  match: m,
  candidate: c,
  userName,
  busy,
  onSend,
  onDiscard,
  onStage,
  onNotes,
}: {
  match: Match;
  candidate: PublicCandidate;
  userName: string;
  busy: boolean;
  onSend: (text: string) => void;
  onDiscard: () => void;
  onStage: (s: Stage) => void;
  onNotes: (n: string) => void;
}) {
  const [text, setText] = useState(m.draft?.text ?? "");
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(m.notes);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-start gap-3 pb-3 border-b border-line">
        <Avatar name={c.name} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold leading-tight">{c.name}, {c.age}</h2>
            <ScorePill score={m.crm.compatibility || m.score} />
          </div>
          <p className="text-xs text-ink-2">{c.job} · {c.location ?? `${c.distanceKm} km away`}</p>
        </div>
        <select
          value={m.stage}
          onChange={(e) => onStage(e.target.value as Stage)}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
          aria-label="Stage"
        >
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </header>

      <div className="flex-1 overflow-y-auto thin-scroll py-3 space-y-4">
        <section>
          <h3 className="text-xs font-semibold text-ink-2 mb-1.5">What the agent knows</h3>
          <p className="text-sm">{m.crm.summary || "Nothing yet. Once the conversation starts, the agent keeps a running read on this person here."}</p>
          <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1.5 text-xs">
            <dt className="text-ink-3">Read</dt>
            <dd><span className={`rounded-md px-1.5 py-0.5 ${sentimentTone[m.crm.sentiment]}`}>{m.crm.sentiment}</span>{m.crm.vibe ? <span className="ml-2 text-ink-2">{m.crm.vibe}</span> : null}</dd>
            <dt className="text-ink-3">Next step</dt>
            <dd>{m.crm.nextStep}</dd>
            {m.crm.dateIdea ? (<><dt className="text-ink-3">Date idea</dt><dd>{m.crm.dateIdea}</dd></>) : null}
            <dt className="text-ink-3">Into</dt>
            <dd><Chips items={m.crm.interests} /></dd>
            <dt className="text-ink-3">Green flags</dt>
            <dd><Chips items={m.crm.greenFlags} tone="bg-mint-soft text-mint" /></dd>
            <dt className="text-ink-3">Red flags</dt>
            <dd><Chips items={m.crm.redFlags} tone="bg-rose-soft text-rose" /></dd>
          </dl>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-ink-2 mb-1.5">Conversation</h3>
          <div className="space-y-2">
            {m.messages.length === 0 && <p className="text-xs text-ink-3">No messages yet.</p>}
            {m.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.from === "user" ? "bg-ink text-white rounded-br-sm" : "bg-slate-soft rounded-bl-sm"}`}>
                  {msg.text}
                  <div className={`mt-0.5 text-[10px] ${msg.from === "user" ? "text-white/60" : "text-ink-3"}`}>
                    {msg.from === "user" ? (msg.sentBy === "agent" ? "sent by agent" : "sent by you") : c.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {m.draft && (
          <section className="rounded-2xl border-2 border-rose/40 bg-rose-soft/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-rose">Agent wants to send</h3>
              <span className="text-[11px] text-ink-3">as {userName}</span>
            </div>
            {editing ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-line bg-surface p-2 text-sm resize-none"
                autoFocus
              />
            ) : (
              <div className="flex justify-end">
                <div className="max-w-[90%] rounded-2xl rounded-br-sm bg-ink text-white px-3 py-2 text-sm">{text}</div>
              </div>
            )}
            <p className="mt-2 text-xs text-ink-2"><span className="text-ink-3">Why: </span>{m.draft.rationale}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" disabled={busy || !text.trim()} onClick={() => onSend(text)}>Send</Button>
              <Button onClick={() => setEditing((e) => !e)} disabled={busy}>{editing ? "Preview" : "Edit"}</Button>
              <Button variant="danger" onClick={onDiscard} disabled={busy} className="ml-auto">Discard</Button>
            </div>
          </section>
        )}

        {!m.draft && m.messages[m.messages.length - 1]?.from === "match" && (
          <p className="text-xs text-ink-3">{c.name} replied. Run a cycle to get a draft.</p>
        )}

        <section>
          <h3 className="text-xs font-semibold text-ink-2 mb-1.5">Your notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== m.notes && onNotes(notes)}
            rows={2}
            placeholder="Anything the agent should know about this one"
            className="w-full rounded-xl border border-line bg-surface p-2 text-sm resize-none"
          />
        </section>

        <section>
          <h3 className="text-xs font-semibold text-ink-2 mb-1.5">Their profile</h3>
          <p className="text-sm">{c.bio}</p>
          <ul className="mt-2 space-y-1.5">
            {c.prompts.map((p) => (
              <li key={p.q} className="text-xs"><span className="text-ink-3">{p.q}: </span>{p.a}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
