import type { CrmFields, Stage } from "@/lib/types";

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  // Deterministic hue from the name so each person keeps their colour.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <div
      className="shrink-0 rounded-full grid place-items-center font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 45% 55%)` }}
      aria-hidden
    >
      {name[0]}
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-mint-soft text-mint" : score >= 50 ? "bg-amber-soft text-amber" : "bg-slate-soft text-ink-2";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>{score}</span>;
}

export const sentimentTone: Record<CrmFields["sentiment"], string> = {
  hot: "bg-rose-soft text-rose",
  warm: "bg-amber-soft text-amber",
  neutral: "bg-slate-soft text-ink-2",
  cold: "bg-slate-soft text-ink-3",
};

export const stageTone: Record<Stage, string> = {
  new: "text-ink-2",
  chatting: "text-ink-2",
  warm: "text-amber",
  date_proposed: "text-rose",
  date_set: "text-mint",
  cold: "text-ink-3",
  passed: "text-ink-3",
};

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  const v = {
    primary: "bg-rose text-white hover:bg-[#cf3a5f]",
    secondary: "bg-surface border border-line hover:bg-slate-soft",
    ghost: "hover:bg-slate-soft text-ink-2",
    danger: "text-ink-2 hover:bg-rose-soft hover:text-rose",
  }[variant];
  return (
    <button className={`${base} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Chips({ items, tone = "bg-slate-soft text-ink-2" }: { items: string[]; tone?: string }) {
  if (!items.length) return <span className="text-ink-3">none</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i} className={`rounded-md px-1.5 py-0.5 text-xs ${tone}`}>{i}</span>
      ))}
    </span>
  );
}
