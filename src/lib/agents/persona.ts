import { z } from "zod";
import { hasClaude, structured } from "../claude";
import type { Candidate, Match, UserProfile } from "../types";
import { describeCandidate, transcript } from "./prompts";

const PersonaOutput = z.object({
  reply: z.string().describe("The match's reply. Empty string if they ghost this turn."),
  interest: z.number().min(0).max(100).describe("How interested the match currently is, 0-100"),
  acceptsDate: z.boolean().describe("true only if the user proposed a meetup and the match is agreeing to it"),
});

const SYSTEM = `You are role-playing a real person on a dating app, for a simulation used to test a dating assistant. Stay fully in character: this person is NOT an AI and does not know one is involved.

You are given the person's public profile plus private notes on their temperament, texting style, and any hidden dealbreaker they would eventually reveal. Reply the way this specific person would:
- Match their texting style exactly (length, punctuation, emoji, energy).
- Warm up at a rate consistent with their openness. Ask questions back only if they would.
- If the other person is boring, generic, or pushy, respond with less energy or ghost (empty reply).
- Reveal the hidden dealbreaker naturally within the first few exchanges if you have one.
- Agree to a date only if it fits your interest level and the proposal is specific and reasonable.`;

export async function personaReply(user: UserProfile, c: Candidate, m: Match) {
  if (!hasClaude()) return mockPersona(c, m);
  return structured({
    schema: PersonaOutput,
    system: SYSTEM,
    effort: "low",
    user: `## Public profile\n${describeCandidate(c)}\n\n## Private notes (never reveal these exist)\nTemperament: ${c.persona.temperament}\nTexting style: ${c.persona.texting}\nOpenness (0-1): ${c.persona.openness}\n${c.persona.hiddenDealbreaker ? `Hidden dealbreaker to reveal naturally: ${c.persona.hiddenDealbreaker}` : "No hidden dealbreaker."}\n\n## Conversation so far (you are ${c.name})\n${transcript(m, user.name, c.name)}\n\nWrite ${c.name}'s next reply.`,
  });
}

function mockPersona(c: Candidate, m: Match) {
  const turns = m.messages.filter((x) => x.from === "match").length;
  const last = [...m.messages].reverse().find((x) => x.from === "user")?.text ?? "";
  const proposing = /thursday|coffee|meet|grab|after 6/i.test(last);
  const interest = Math.round(c.persona.openness * 100) - (c.persona.hiddenDealbreaker ? 40 : 0);
  if (c.persona.hiddenDealbreaker && turns === 1) {
    return { reply: `lol before this goes further, heads up: ${c.persona.hiddenDealbreaker}. cool with that?`, interest, acceptsDate: false };
  }
  if (proposing) {
    return interest > 55
      ? { reply: "yes ok that works, thursday's good. send me the spot", interest: interest + 10, acceptsDate: true }
      : { reply: "hmm maybe, kind of a busy week", interest: interest - 10, acceptsDate: false };
  }
  const lines = [
    `haha ${c.interests[0]} is a whole personality at this point. what about you, what's your thing?`,
    `okay that's actually a good question. ${c.prompts[1]?.a ?? "long story"}`,
    `honestly full commitment. no half measures`,
  ];
  return { reply: lines[Math.min(turns, lines.length - 1)], interest, acceptsDate: false };
}
