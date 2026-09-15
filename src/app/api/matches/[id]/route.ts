import { NextResponse } from "next/server";
import { getState, log, now, publicState, save, uid } from "@/lib/db";
import { deliver, sendDraft } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Approve the draft (optionally edited) or send a custom message. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as { action: "send" | "discard"; text?: string };
  const s = getState();
  const m = s.matches.find((x) => x.id === id);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  const name = s.candidates.find((c) => c.id === m.candidateId)?.name ?? "match";

  if (body.action === "discard") {
    m.draft = undefined;
    log("system", `Discarded draft to ${name}`, { matchId: m.id });
  } else if (m.draft) {
    const edited = body.text !== undefined && body.text !== m.draft.text;
    await sendDraft(m, "human", body.text);
    log("chat", `You ${edited ? "edited and " : ""}sent to ${name}: "${(body.text ?? "").slice(0, 60)}"`, { matchId: m.id });
  } else if (body.text) {
    await deliver(m, body.text);
    m.messages.push({ id: uid("m_"), at: now(), from: "user", text: body.text, sentBy: "human" });
    if (m.stage === "new") m.stage = "chatting";
    m.updatedAt = now();
    log("chat", `You sent to ${name}: "${body.text.slice(0, 60)}"`, { matchId: m.id });
  }
  save();
  return NextResponse.json(publicState());
}

/** Manual CRM edits: stage or notes. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as { stage?: Stage; notes?: string };
  const s = getState();
  const m = s.matches.find((x) => x.id === id);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (body.stage && body.stage !== m.stage) {
    m.stage = body.stage;
    log("system", `Moved ${s.candidates.find((c) => c.id === m.candidateId)?.name} to ${body.stage}`, { matchId: m.id });
  }
  if (body.notes !== undefined) m.notes = body.notes;
  m.updatedAt = now();
  save();
  return NextResponse.json(publicState());
}
