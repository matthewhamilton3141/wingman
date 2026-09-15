import { NextResponse } from "next/server";
import { getState, log, publicState, save } from "@/lib/db";

export async function PUT(req: Request) {
  const { mode } = (await req.json()) as { mode: "approve" | "autopilot" };
  const s = getState();
  s.mode = mode;
  log("system", mode === "autopilot" ? "Autopilot on: agent sends without approval" : "Approve mode: agent drafts, you send");
  save();
  return NextResponse.json(publicState());
}
