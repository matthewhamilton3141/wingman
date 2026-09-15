import { NextResponse } from "next/server";
import { publicState } from "@/lib/db";
import { runCycle } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const r = await runCycle();
  return NextResponse.json({ ...r, state: publicState() });
}
