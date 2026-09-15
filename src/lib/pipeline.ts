import { draftReply } from "./agents/chat";
import { scoreCandidate } from "./agents/scout";
import { getState, log, now, save, uid } from "./db";
import { getPlatform } from "./platforms";
import { placeholderCandidate } from "./platforms/hinge";
import type { Candidate, CrmFields, Match, Message, Scored, Stage } from "./types";

const ACTIVE: Stage[] = ["new", "chatting", "warm", "date_proposed"];

const emptyCrm = (score: number): CrmFields => ({
  summary: "",
  interests: [],
  vibe: "",
  sentiment: "neutral",
  redFlags: [],
  greenFlags: [],
  nextStep: "Send opener",
  dateIdea: "",
  compatibility: score,
});

function candidate(id: string) {
  const c = getState().candidates.find((x) => x.id === id);
  if (!c) throw new Error(`no candidate ${id}`);
  return c;
}

function push(m: Match, msg: Omit<Message, "id" | "at">) {
  m.messages.push({ id: uid("m_"), at: now(), ...msg });
  m.updatedAt = now();
}

/** Apply a draft to the thread: deliver it, append the message, update CRM and stage. */
export async function sendDraft(m: Match, sentBy: "agent" | "human", override?: string) {
  if (!m.draft) return;
  const text = override ?? m.draft.text;
  await deliver(m, text);
  push(m, { from: "user", text, sentBy });
  m.crm = m.draft.crm;
  m.stage = m.draft.stage;
  m.draft = undefined;
}

/** Send through the real platform when there is one; the simulator only needs the local record. */
export async function deliver(m: Match, text: string) {
  const platform = getPlatform();
  if (platform.send) await platform.send(candidate(m.candidateId), m, text);
}

async function discover() {
  const s = getState();
  const platform = getPlatform();
  const seen = new Set(Object.keys(s.scored));
  const fresh = await platform.discover(seen);
  if (!fresh.length) return;
  // Real platforms hand us people we've never seen; keep them so the UI and agents can refer back.
  for (const c of fresh) if (!s.candidates.some((x) => x.id === c.id)) s.candidates.push(c);
  log("scout", `Reviewing ${fresh.length} new profile${fresh.length === 1 ? "" : "s"} on ${platform.name}`);
  await Promise.all(
    fresh.map(async (c) => {
      try {
        const r = await scoreCandidate(s.user, s.preferences, c);
        s.scored[c.id] = { candidateId: c.id, at: now(), ...r };
        log("scout", `${c.name}: ${r.score}/100 → ${r.decision}. ${r.reasons[0] ?? ""}${r.concerns[0] ? ` Concern: ${r.concerns[0]}` : ""}`, { candidateId: c.id });
        if (r.decision === "like") await likeCandidate(c.id);
        else await platform.pass(c);
      } catch (e) {
        log("system", `Scout failed on ${c.name}: ${(e as Error).message}`, { candidateId: c.id });
      }
    }),
  );
}

function createMatch(c: Candidate, scored?: Scored): Match {
  const s = getState();
  const m: Match = {
    id: uid("mt_"),
    candidateId: c.id,
    stage: "new",
    score: scored?.score ?? 50,
    messages: [],
    notes: "",
    crm: emptyCrm(scored?.score ?? 50),
    createdAt: now(),
    updatedAt: now(),
  };
  s.matches.unshift(m);
  log("scout", `It's a match with ${c.name}!`, { matchId: m.id, candidateId: c.id });
  return m;
}

/** Queue the scout's opener as a draft (or send it straight away in autopilot). */
async function queueOpener(m: Match, c: Candidate, opener: string) {
  const s = getState();
  m.draft = {
    text: opener,
    rationale: "Opener from the scout, referencing their profile.",
    at: now(),
    crm: { ...m.crm, nextStep: "Wait for their reply" },
    stage: "chatting",
  };
  if (s.mode === "autopilot") {
    await sendDraft(m, "agent");
    log("chat", `Sent opener to ${c.name}`, { matchId: m.id });
  } else {
    log("chat", `Drafted opener for ${c.name}, waiting for your approval`, { matchId: m.id });
  }
}

export async function likeCandidate(candidateId: string) {
  const s = getState();
  const platform = getPlatform();
  const c = candidate(candidateId);
  const scored = s.scored[candidateId];
  if (s.matches.some((m) => m.candidateId === candidateId)) return;
  // On Hinge the opener rides along as the like comment, so it lands before they even match.
  const { matched, commented } = await platform.like(c, scored?.opener);
  if (!matched) {
    log("scout", `Liked ${c.name}${commented ? ` with a comment: "${scored?.opener?.slice(0, 60)}"` : ""}. No match yet.`, { candidateId });
    return;
  }
  const m = createMatch(c, scored);
  if (!scored?.opener) return;
  if (commented) {
    push(m, { from: "user", text: scored.opener, sentBy: "agent" });
    m.stage = "chatting";
    m.crm.nextStep = "Wait for their reply";
  } else {
    await queueOpener(m, c, scored.opener);
  }
}

/**
 * Real platforms match asynchronously: pull the current match list and
 * reconcile it with what we know. New matches get their thread imported.
 */
async function syncMatches() {
  const s = getState();
  const platform = getPlatform();
  if (!platform.matches) return;
  const rows = await platform.matches();
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
  const known = new Set(s.matches.map((m) => norm(candidate(m.candidateId).name)));
  for (const row of rows) {
    if (known.has(norm(row.name))) continue;
    known.add(norm(row.name));
    // Prefer someone the scout liked; otherwise this match pre-dates Wingman.
    let c = s.candidates.find((x) => norm(x.name) === norm(row.name) && s.scored[x.id]?.decision === "like");
    if (!c) {
      c = placeholderCandidate(row.name);
      s.candidates.push(c);
    }
    const m = createMatch(c, s.scored[c.id]);
    try {
      const thread = platform.thread ? await platform.thread(c) : [];
      for (const t of thread) push(m, { from: t.from, text: t.text, sentBy: t.from === "user" ? "human" : "persona" });
      if (thread.length) {
        m.stage = "chatting";
        log("system", `Imported ${thread.length} messages with ${c.name} from ${platform.name}`, { matchId: m.id });
      } else if (s.scored[c.id]?.opener && !thread.length) {
        await queueOpener(m, c, s.scored[c.id].opener!);
      }
    } catch (e) {
      log("system", `Couldn't import the thread with ${c.name}: ${(e as Error).message}`, { matchId: m.id });
    }
  }
}

async function advance(m: Match) {
  const s = getState();
  const platform = getPlatform();
  const c = candidate(m.candidateId);
  const last = m.messages[m.messages.length - 1];

  // Their turn: the user spoke last (or a draft is pending and we shouldn't double up).
  if (last?.from === "user") {
    const r = await platform.awaitReply(s.user, c, m);
    if (r.pending) return; // real platform, no reply yet: check again next cycle
    if (!r.text) {
      const ghosts = (m.notes.match(/\[no reply\]/g) ?? []).length + 1;
      m.notes = `${m.notes} [no reply]`.trim();
      log("persona", `${c.name} didn't reply (${ghosts})`, { matchId: m.id });
      if (ghosts >= 2) {
        m.stage = "cold";
        m.crm.sentiment = "cold";
        m.crm.nextStep = "Let it go";
        log("system", `${c.name} moved to Cold after ${ghosts} unanswered messages`, { matchId: m.id });
      }
      return;
    }
    push(m, { from: "match", text: r.text, sentBy: "persona" });
    log("persona", `${c.name}: "${r.text.slice(0, 80)}${r.text.length > 80 ? "…" : ""}"`, { matchId: m.id });
    if (r.acceptsDate && m.stage === "date_proposed") {
      m.stage = "date_set";
      m.crm.sentiment = "hot";
      m.crm.nextStep = "Confirm details and show up";
      log("system", `${c.name} said yes to the date 🎉`, { matchId: m.id });
    }
  }

  // Our turn: draft (and send, in autopilot).
  const nowLast = m.messages[m.messages.length - 1];
  if (nowLast?.from === "match" && !m.draft) {
    const r = await draftReply(s.user, s.preferences, c, m);
    m.draft = { text: r.reply, rationale: r.rationale, at: now(), crm: r.crm, stage: r.suggestedStage };
    // Keep the live CRM fresh even before the draft is sent.
    m.crm = r.crm;
    if (s.mode === "autopilot") {
      await sendDraft(m, "agent");
      log("chat", `→ ${c.name}: "${r.reply.slice(0, 80)}${r.reply.length > 80 ? "…" : ""}"`, { matchId: m.id });
    } else {
      log("chat", `Drafted reply to ${c.name}: "${r.reply.slice(0, 60)}…"`, { matchId: m.id });
    }
  } else if (m.draft && s.mode === "autopilot") {
    const text = m.draft.text;
    await sendDraft(m, "agent");
    log("chat", `→ ${c.name}: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`, { matchId: m.id });
  }
}

/** One full pass: score new profiles, pick up new matches, then advance every active thread one step. */
export async function runCycle() {
  const s = getState();
  if (s.running) return { skipped: true };
  s.running = true;
  try {
    await discover().catch((e) => log("system", `Discovery failed: ${(e as Error).message}`));
    await syncMatches().catch((e) => log("system", `Match sync failed: ${(e as Error).message}`));
    const active = s.matches.filter((m) => ACTIVE.includes(m.stage));
    await Promise.all(
      active.map((m) =>
        advance(m).catch((e) => log("system", `Thread with ${candidate(m.candidateId).name} errored: ${(e as Error).message}`, { matchId: m.id })),
      ),
    );
    s.lastCycleAt = now();
  } finally {
    s.running = false;
    save();
  }
  return { skipped: false };
}
