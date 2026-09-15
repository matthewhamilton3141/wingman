"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PublicState, Stage } from "@/lib/types";
import { Pipeline } from "@/components/Pipeline";
import { MatchDetail } from "@/components/MatchDetail";
import { Discovery } from "@/components/Discovery";
import { PreferencesPanel } from "@/components/PreferencesPanel";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PhonePanel } from "@/components/PhonePanel";
import { Button } from "@/components/ui";

type Tab = "pipeline" | "discovery" | "phone" | "preferences" | "activity";

export default function Home() {
  const [s, setS] = useState<PublicState | null>(null);
  const [tab, setTab] = useState<Tab>("pipeline");
  const [selected, setSelected] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [cycling, setCycling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);

  const refresh = useCallback(async () => {
    try { setS(await api.state()); } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 4000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  const act = useCallback(async (fn: () => Promise<PublicState>) => {
    setBusy(true);
    setError(null);
    try { setS(await fn()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);

  const cycle = useCallback(async () => {
    if (cycling) return;
    setCycling(true);
    setError(null);
    try {
      const r = await api.cycle();
      setS(r.state);
    } catch (e) { setError((e as Error).message); } finally { setCycling(false); }
  }, [cycling]);

  // Keep-running loop: fire a cycle, wait, repeat while the switch is on.
  useEffect(() => {
    autoRef.current = auto;
    if (!auto) return;
    let stop = false;
    (async () => {
      while (!stop && autoRef.current) {
        await cycle();
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const byId = useMemo(() => Object.fromEntries((s?.candidates ?? []).map((c) => [c.id, c])), [s?.candidates]);
  const sel = s?.matches.find((m) => m.id === selected);
  const openMatch = (id: string) => { setSelected(id); setTab("pipeline"); };

  if (!s) return <main className="p-8 text-ink-2">Loading…</main>;

  const drafts = s.matches.filter((m) => m.draft).length;
  const dates = s.matches.filter((m) => m.stage === "date_set").length;
  const reviewed = Object.keys(s.scored).length;
  const active = s.matches.filter((m) => !["cold", "passed"].includes(m.stage)).length;

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-5 py-3 border-b border-line bg-surface/70 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight" style={{ fontVariationSettings: '"wdth" 90' }}>Wingman</h1>
        <nav className="flex gap-1 ml-2">
          {(["pipeline", "discovery", ...(s.platform === "Hinge" ? (["phone"] as Tab[]) : []), "preferences", "activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-ink text-white" : "text-ink-2 hover:bg-slate-soft"}`}
            >
              {t}
              {t === "pipeline" && drafts > 0 && <span className="ml-1.5 rounded-full bg-rose text-white text-[10px] px-1.5 py-0.5 tabular-nums">{drafts}</span>}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => s.platform === "Hinge" && setTab("phone")}
            className={`text-xs rounded-md px-2 py-0.5 ${s.platform === "Hinge" ? "bg-rose-soft text-rose hover:bg-rose hover:text-white" : "bg-slate-soft text-ink-2"}`}
            title={s.platform === "Hinge" ? "Real Hinge, driven through iPhone Mirroring by the sidecar" : "Simulated matches; set PLATFORM=hinge for the real thing"}
          >
            {s.platform === "Hinge" ? "Hinge · live" : "Simulator"}
          </button>
          <span className={`text-xs ${s.llm === "mock" ? "text-amber" : "text-mint"}`}>
            {s.llm === "api" ? "Claude Opus 5 · API" : s.llm === "agent-sdk" ? "Claude Opus 5 · your Claude Code login" : "Mock mode"}
          </span>
          <label className="flex items-center gap-2 text-sm">
            <span className={s.mode === "approve" ? "font-semibold" : "text-ink-3"}>Approve</span>
            <button
              role="switch"
              aria-checked={s.mode === "autopilot"}
              onClick={() => act(() => api.mode(s.mode === "approve" ? "autopilot" : "approve"))}
              className={`relative h-5 w-9 rounded-full transition-colors ${s.mode === "autopilot" ? "bg-rose" : "bg-line"}`}
            >
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left]" style={{ left: s.mode === "autopilot" ? 18 : 2 }} />
            </button>
            <span className={s.mode === "autopilot" ? "font-semibold" : "text-ink-3"}>Autopilot</span>
          </label>
          <Button onClick={() => setAuto((a) => !a)} variant={auto ? "secondary" : "ghost"}>
            {auto ? <><span className="h-2 w-2 rounded-full bg-mint pulse" />Stop loop</> : "Keep running"}
          </Button>
          <Button variant="primary" onClick={cycle} disabled={cycling}>
            {cycling ? <><span className="h-2 w-2 rounded-full bg-white pulse" />Agents working…</> : "Run cycle"}
          </Button>
        </div>
      </header>

      <p className="px-5 py-2 text-sm text-ink-2 border-b border-line">
        {reviewed === 0 ? (
          <>The scout hasn&rsquo;t reviewed anyone yet. Run a cycle to start.</>
        ) : (
          <>
            Reviewed <b className="text-ink">{reviewed}</b> profiles, <b className="text-ink">{active}</b> active {active === 1 ? "match" : "matches"},{" "}
            {drafts > 0 ? <b className="text-rose">{drafts} {drafts === 1 ? "draft" : "drafts"} waiting for you</b> : <span>no drafts waiting</span>}
            {dates > 0 && <>, <b className="text-mint">{dates} {dates === 1 ? "date" : "dates"} set</b></>}.
          </>
        )}
        {error && <span className="ml-3 text-rose">{error}</span>}
      </p>

      <div className="flex-1 min-h-0 flex">
        <section className="flex-1 min-w-0 p-5 overflow-auto thin-scroll">
          {tab === "pipeline" && (
            <Pipeline
              matches={s.matches}
              candidates={s.candidates}
              selected={selected}
              onSelect={setSelected}
              onMove={(id, stage: Stage) => act(() => api.patch(id, { stage }))}
            />
          )}
          {tab === "phone" && <PhonePanel />}
          {tab === "discovery" && (
            <Discovery candidates={s.candidates} scored={s.scored} matches={s.matches} busy={busy} onAct={(id, a) => act(() => api.candidate(id, a))} />
          )}
          {tab === "preferences" && (
            <PreferencesPanel key={s.lastCycleAt ?? "p"} prefs={s.preferences} user={s.user} busy={busy} onSave={(b) => act(() => api.prefs(b))} />
          )}
          {tab === "activity" && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Everything the agents did</h2>
                <Button variant="danger" onClick={() => { if (confirm("Reset all matches and scores?")) act(() => api.reset()); }}>Reset demo</Button>
              </div>
              <ActivityFeed activity={s.activity} onOpen={openMatch} />
            </div>
          )}
        </section>

        <aside className="w-[340px] shrink-0 border-l border-line bg-surface p-4 overflow-hidden flex flex-col">
          {sel && byId[sel.candidateId] ? (
            <MatchDetail
              key={`${sel.id}:${sel.draft?.at ?? ""}:${sel.notes}`}
              match={sel}
              candidate={byId[sel.candidateId]}
              userName={s.user.name}
              busy={busy}
              onSend={(text) => act(() => api.send(sel.id, text))}
              onDiscard={() => act(() => api.discard(sel.id))}
              onStage={(stage) => act(() => api.patch(sel.id, { stage }))}
              onNotes={(notes) => act(() => api.patch(sel.id, { notes }))}
            />
          ) : (
            <div className="flex flex-col h-full">
              <h2 className="text-xs font-semibold text-ink-2 mb-2">Latest</h2>
              <div className="overflow-y-auto thin-scroll flex-1">
                <ActivityFeed activity={s.activity} onOpen={openMatch} compact />
              </div>
              <p className="text-xs text-ink-3 mt-3">Pick a match to read the thread and approve drafts.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
