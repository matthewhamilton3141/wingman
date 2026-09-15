import { personaReply } from "../agents/persona";
import { getState } from "../db";
import type { DatingPlatform } from "./types";

export const simulatedPlatform: DatingPlatform = {
  name: "SimDate",
  async discover(seen) {
    return getState().candidates.filter((c) => !seen.has(c.id));
  },
  async like(c) {
    // Persona openness stands in for "did they swipe right on you".
    return { matched: c.persona.openness >= 0.35 };
  },
  async pass() {},
  async awaitReply(user, c, m) {
    const r = await personaReply(user, c, m);
    return { text: r.reply.trim(), acceptsDate: r.acceptsDate };
  },
};
