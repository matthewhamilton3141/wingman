import { z } from "zod";
import { hasClaude, structured } from "../claude";
import type { Candidate, Preferences, Scored, UserProfile } from "../types";
import { describeCandidate, describePrefs, describeUser } from "./prompts";

const ScoutOutput = z.object({
  score: z.number().min(0).max(100).describe("Overall compatibility 0-100"),
  reasons: z.array(z.string()).describe("2-4 short, concrete reasons this could work"),
  concerns: z.array(z.string()).describe("0-3 short concerns or dealbreaker hits; empty if none"),
  dealbreakerHit: z.boolean().describe("true if any stated dealbreaker is clearly present"),
  opener: z
    .string()
    .describe("A first message in the user's voice referencing something specific from the profile. Under 30 words."),
});

const SYSTEM = `You are the Scout agent for a dating wingman. You evaluate a candidate's dating profile against the user's stated preferences and produce a compatibility score, honest reasons, concerns, and a first message.

Rules:
- A clear dealbreaker hit caps the score at 30, no matter how compatible otherwise.
- Age outside the range or distance beyond the limit is a concern and lowers the score, but is not automatically a dealbreaker unless it is far off.
- Shared interests and evidence the candidate has their own life count for a lot. Reward specificity in their profile.
- Be honest and a little skeptical. Do not inflate. A 90+ should be rare.
- The opener must sound like the user's own texting voice, reference one specific thing from the candidate's profile, and ask a real question. No pickup lines.
- The voice samples show rhythm, casing and energy. Never reuse a sample's actual phrasing; every opener should be freshly written for this profile.`;

export async function scoreCandidate(
  user: UserProfile,
  prefs: Preferences,
  c: Candidate,
): Promise<Omit<Scored, "at" | "candidateId">> {
  if (!hasClaude()) return mockScore(prefs, user, c);
  const out = await structured({
    schema: ScoutOutput,
    system: SYSTEM,
    effort: "low",
    user: `## The user\n${describeUser(user)}\n\n## Their preferences\n${describePrefs(prefs)}\n\n## Candidate profile\n${describeCandidate(c)}`,
  });
  const score = Math.round(out.dealbreakerHit ? Math.min(out.score, 30) : out.score);
  return {
    score,
    decision: score >= prefs.likeThreshold ? "like" : "pass",
    reasons: out.reasons,
    concerns: out.concerns,
    opener: out.opener,
  };
}

function mockScore(prefs: Preferences, user: UserProfile, c: Candidate): Omit<Scored, "at" | "candidateId"> {
  const shared = c.interests.filter((i) => user.interests.some((u) => u.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(u.toLowerCase())));
  let score = 45 + shared.length * 15;
  const reasons: string[] = [];
  const concerns: string[] = [];
  if (shared.length) reasons.push(`Shared interests: ${shared.join(", ")}`);
  if (c.prompts.some((p) => p.a.length > 60)) { score += 8; reasons.push("Profile is specific and effortful"); }
  if (c.age < prefs.ageRange[0] || c.age > prefs.ageRange[1]) { score -= 20; concerns.push(`Age ${c.age} is outside ${prefs.ageRange.join("-")}`); }
  else score += 5;
  if (c.distanceKm > prefs.maxDistanceKm) { score -= 15; concerns.push(`${c.distanceKm} km is past your ${prefs.maxDistanceKm} km limit`); }
  const text = `${c.bio} ${c.prompts.map((p) => p.a).join(" ")}`.toLowerCase();
  const hit = ["hookup", "casual", "no strings", "vape", "smoke", "students."].find((k) => text.includes(k));
  if (hit) { score = Math.min(score, 30); concerns.push(`Dealbreaker signal: "${hit}"`); }
  score = Math.max(5, Math.min(95, score));
  if (!reasons.length) reasons.push("Not much overlap on paper");
  const hook = c.prompts[0]?.a ?? c.bio;
  return {
    score,
    decision: score >= prefs.likeThreshold ? "like" : "pass",
    reasons,
    concerns,
    opener: `ok "${hook.slice(0, 40)}${hook.length > 40 ? "..." : ""}" is a strong opener. what's the story there?`,
  };
}
