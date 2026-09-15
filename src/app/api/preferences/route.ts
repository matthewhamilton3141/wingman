import { NextResponse } from "next/server";
import { getState, log, publicState, save } from "@/lib/db";
import type { Preferences, UserProfile } from "@/lib/types";

export async function PUT(req: Request) {
  const body = (await req.json()) as { preferences?: Partial<Preferences>; user?: Partial<UserProfile>; rescore?: boolean };
  const s = getState();
  if (body.preferences) s.preferences = { ...s.preferences, ...body.preferences };
  if (body.user) s.user = { ...s.user, ...body.user };
  if (body.rescore) {
    // Re-evaluate profiles that never became matches with the new preferences.
    for (const id of Object.keys(s.scored)) {
      if (!s.matches.some((m) => m.candidateId === id)) delete s.scored[id];
    }
    log("system", "Preferences updated; unmatched profiles will be re-scored next cycle");
  } else {
    log("system", "Preferences updated");
  }
  save();
  return NextResponse.json(publicState());
}
