import { NextResponse } from "next/server";
import { getState } from "@/lib/db";
import { SIDECAR_URL } from "@/lib/platforms/hinge";

export const dynamic = "force-dynamic";

/** Health of the Hinge sidecar, for the Phone panel. */
export async function GET() {
  if (getState().platform !== "Hinge") return NextResponse.json({ ok: false, platform: "SimDate" });
  try {
    const r = await fetch(`${SIDECAR_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return NextResponse.json(await r.json());
  } catch (e) {
    return NextResponse.json({ ok: false, platform: "Hinge", offline: true, error: (e as Error).message, url: SIDECAR_URL });
  }
}
