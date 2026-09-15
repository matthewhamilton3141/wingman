"use client";
import { useEffect, useState } from "react";

interface Health {
  ok: boolean;
  platform: string;
  offline?: boolean;
  error?: string;
  url?: string;
  window?: { w: number; h: number } | null;
  screenshot?: true | string;
  llm?: boolean;
  busy?: boolean;
  current?: { id: string; name: string } | null;
  last?: { screen: string; description: string; at: string } | null;
  recent?: string[];
}

/** Live view of the mirrored iPhone plus the sidecar's health, so you can watch the agents drive Hinge. */
export function PhonePanel() {
  const [h, setH] = useState<Health | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/sidecar", { cache: "no-store" });
        if (alive) setH(await r.json());
      } catch { /* next tick */ }
    };
    poll();
    const t = setInterval(() => { poll(); setTick((x) => x + 1); }, 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!h) return <p className="text-sm text-ink-3">Checking the sidecar…</p>;

  const checks: { label: string; ok: boolean; hint: string }[] = [
    { label: "Sidecar running", ok: !h.offline, hint: `npm run sidecar (expected at ${h.url ?? "http://127.0.0.1:4747"})` },
    { label: "iPhone Mirroring window", ok: !!h.window, hint: "Open iPhone Mirroring and unlock the phone" },
    { label: "Screen capture", ok: h.screenshot === true, hint: typeof h.screenshot === "string" ? h.screenshot : "Grant Screen Recording to your terminal" },
    { label: "Claude vision", ok: !!h.llm, hint: "Set ANTHROPIC_API_KEY or log in to Claude Code" },
  ];

  return (
    <div className="flex gap-6 h-full min-h-0">
      <div className="shrink-0 flex flex-col items-center gap-2">
        <div className="rounded-[28px] border-[6px] border-ink bg-ink overflow-hidden shadow-xl" style={{ width: 300, height: 640 }}>
          {h.ok ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={tick} src={`/api/sidecar/screen?t=${tick}`} alt="Mirrored iPhone" className="w-full h-full object-contain bg-black" />
          ) : (
            <div className="w-full h-full grid place-items-center text-center text-white/70 text-sm p-6">Phone not connected</div>
          )}
        </div>
        <p className="text-xs text-ink-3">
          {h.busy ? <span className="text-rose">● agents driving the phone</span> : "idle"}
          {h.current && <> · looking at <b className="text-ink">{h.current.name}</b></>}
        </p>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-auto thin-scroll">
        <section>
          <h2 className="font-semibold mb-2">Hinge via iPhone Mirroring</h2>
          <ul className="space-y-1.5 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${c.ok ? "bg-mint" : "bg-rose"}`} />
                <span className={c.ok ? "" : "text-ink-2"}>
                  {c.label}
                  {!c.ok && <span className="block text-xs text-ink-3">{c.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {h.last && (
          <section className="text-sm">
            <h3 className="text-xs font-semibold text-ink-2 mb-1">Last seen</h3>
            <p><span className="rounded-md bg-slate-soft px-1.5 py-0.5 text-xs font-medium">{h.last.screen}</span> {h.last.description}</p>
          </section>
        )}

        <section className="text-xs">
          <h3 className="font-semibold text-ink-2 mb-1">Sidecar log</h3>
          {h.recent?.length ? (
            <ol className="space-y-1 font-mono text-ink-2">
              {h.recent.map((line, i) => <li key={i} className="truncate">{line}</li>)}
            </ol>
          ) : (
            <p className="text-ink-3">Nothing yet. Run a cycle and the scout will read the profile on screen.</p>
          )}
        </section>

        <section className="text-xs text-ink-3 mt-auto">
          <p>Every action is a real tap on your phone. Keep the Hinge app open on Discover, and keep the mirroring window on screen: the sidecar screenshots it, asks Claude what it sees, and taps where Claude says.</p>
        </section>
      </div>
    </div>
  );
}
