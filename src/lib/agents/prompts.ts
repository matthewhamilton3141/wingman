import type { Candidate, Match, Preferences, PublicCandidate, UserProfile } from "../types";

export function describeUser(u: UserProfile) {
  return `Name: ${u.name}, ${u.age}, ${u.city}
Bio: ${u.bio}
Interests: ${u.interests.join(", ")}
Examples of how ${u.name} actually texts (match this voice):
${u.voiceSamples.map((s) => `- "${s}"`).join("\n")}`;
}

export function describePrefs(p: Preferences) {
  return `Looking for: ${p.goal}
Age range: ${p.ageRange[0]}-${p.ageRange[1]}, within ${p.maxDistanceKm} km
Must-haves: ${p.mustHaves.join("; ")}
Dealbreakers: ${p.dealbreakers.join("; ")}
Nice-to-haves: ${p.niceToHaves.join("; ")}
Conversation style: ${p.tone}`;
}

export function describeCandidate(c: PublicCandidate | Candidate) {
  const where = c.location ? c.location : `${c.distanceKm} km away`;
  return `Name: ${c.name}${c.age ? `, ${c.age}` : ""}, ${where}, ${c.job}
Bio: ${c.bio}
Interests: ${c.interests.join(", ")}
Profile prompts:
${c.prompts.map((p) => `- ${p.q}: "${p.a}"`).join("\n")}`;
}

export function transcript(m: Match, userName: string, matchName: string) {
  if (m.messages.length === 0) return "(no messages yet)";
  return m.messages
    .map((msg) => `${msg.from === "user" ? userName : matchName}: ${msg.text}`)
    .join("\n");
}
