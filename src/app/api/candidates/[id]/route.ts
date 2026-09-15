import { NextResponse } from "next/server";
import { getState, log, publicState, save } from "@/lib/db";
import { likeCandidate } from "@/lib/pipeline";

type Ctx = { params: Promise<{ id: string }> };

/** Override the scout: manually like or pass a scored candidate. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { action } = (await req.json()) as { action: "like" | "pass" };
  const s = getState();
  const sc = s.scored[id];
  if (!sc) return NextResponse.json({ error: "not scored yet" }, { status: 400 });
  sc.decision = action;
  const name = s.candidates.find((c) => c.id === id)?.name;
  log("system", `You overrode the scout: ${action} on ${name}`, { candidateId: id });
  if (action === "like") await likeCandidate(id);
  save();
  return NextResponse.json(publicState());
}
