"use client";
import { useState } from "react";
import type { Preferences, UserProfile } from "@/lib/types";
import { Button } from "./ui";

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      <textarea
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        rows={4}
        className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm"
      />
      <span className="text-[11px] text-ink-3">One per line</span>
    </label>
  );
}

export function PreferencesPanel({
  prefs,
  user,
  busy,
  onSave,
}: {
  prefs: Preferences;
  user: UserProfile;
  busy: boolean;
  onSave: (body: { preferences: Preferences; user: UserProfile; rescore: boolean }) => void;
}) {
  const [p, setP] = useState(prefs);
  const [u, setU] = useState(user);
  const [rescore, setRescore] = useState(true);
  const num = (v: string, d: number) => (Number.isFinite(+v) ? +v : d);

  return (
    <form
      className="grid gap-6 lg:grid-cols-2 max-w-5xl"
      onSubmit={(e) => { e.preventDefault(); onSave({ preferences: p, user: u, rescore }); }}
    >
      <section className="space-y-4">
        <h2 className="font-semibold text-base">Who you&rsquo;re looking for</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs font-semibold text-ink-2">Min age</span>
            <input type="number" value={p.ageRange[0]} onChange={(e) => setP({ ...p, ageRange: [num(e.target.value, 18), p.ageRange[1]] })} className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm" /></label>
          <label className="block"><span className="text-xs font-semibold text-ink-2">Max age</span>
            <input type="number" value={p.ageRange[1]} onChange={(e) => setP({ ...p, ageRange: [p.ageRange[0], num(e.target.value, 30)] })} className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm" /></label>
          <label className="block"><span className="text-xs font-semibold text-ink-2">Max km</span>
            <input type="number" value={p.maxDistanceKm} onChange={(e) => setP({ ...p, maxDistanceKm: num(e.target.value, 25) })} className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm" /></label>
        </div>
        <label className="block"><span className="text-xs font-semibold text-ink-2">What you want</span>
          <textarea value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm" /></label>
        <ListField label="Must-haves" value={p.mustHaves} onChange={(v) => setP({ ...p, mustHaves: v })} />
        <ListField label="Dealbreakers" value={p.dealbreakers} onChange={(v) => setP({ ...p, dealbreakers: v })} />
        <ListField label="Nice-to-haves" value={p.niceToHaves} onChange={(v) => setP({ ...p, niceToHaves: v })} />
        <label className="block"><span className="text-xs font-semibold text-ink-2">Like anyone scoring at least</span>
          <div className="flex items-center gap-3 mt-1">
            <input type="range" min={30} max={95} value={p.likeThreshold} onChange={(e) => setP({ ...p, likeThreshold: +e.target.value })} className="flex-1 accent-[var(--rose)]" />
            <span className="tabular-nums w-8 text-right font-semibold">{p.likeThreshold}</span>
          </div></label>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-base">How the agent talks as you</h2>
        <label className="block"><span className="text-xs font-semibold text-ink-2">Style guide</span>
          <textarea value={p.tone} onChange={(e) => setP({ ...p, tone: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm" /></label>
        <ListField label="Messages you&rsquo;ve actually sent (voice samples)" value={u.voiceSamples} onChange={(v) => setU({ ...u, voiceSamples: v })} />
        <label className="block"><span className="text-xs font-semibold text-ink-2">Your bio</span>
          <textarea value={u.bio} onChange={(e) => setU({ ...u, bio: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-sm" /></label>
        <ListField label="Your interests" value={u.interests} onChange={(v) => setU({ ...u, interests: v })} />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" disabled={busy}>Save preferences</Button>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={rescore} onChange={(e) => setRescore(e.target.checked)} className="accent-[var(--rose)]" />
            Re-score profiles that haven&rsquo;t matched
          </label>
        </div>
      </section>
    </form>
  );
}
