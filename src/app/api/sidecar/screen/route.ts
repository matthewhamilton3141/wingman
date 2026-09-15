import { SIDECAR_URL } from "@/lib/platforms/hinge";

export const dynamic = "force-dynamic";

/** Live screenshot of the mirrored phone, proxied from the sidecar. */
export async function GET() {
  try {
    const r = await fetch(`${SIDECAR_URL}/screen.png`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return new Response(await r.text(), { status: 502 });
    return new Response(await r.arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
