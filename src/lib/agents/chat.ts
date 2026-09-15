import { z } from "zod";
import { hasClaude, structured } from "../claude";
import type { CrmFields, Match, Preferences, PublicCandidate, Stage, UserProfile } from "../types";
import { describeCandidate, describePrefs, describeUser, transcript } from "./prompts";

const ChatOutput = z.object({
  reply: z.string().describe("The next message to send, in the user's voice. Usually 1-3 sentences."),
  rationale: z.string().describe("One sentence on why this message, for the user's review."),
  crm: z.object({
    summary: z.string().describe("2-sentence summary of who this person is and where things stand"),
    interests: z.array(z.string()).describe("Interests learned so far"),
    vibe: z.string().describe("A few words on their personality as it comes through in chat"),
    sentiment: z.enum(["cold", "neutral", "warm", "hot"]).describe("How into it they seem, from their messages"),
    redFlags: z.array(z.string()),
    greenFlags: z.array(z.string()),
    nextStep: z.string().describe("The concrete next move (e.g. 'suggest coffee Thursday', 'wait for reply')"),
    dateIdea: z.string().describe("Best date idea given shared interests; empty string if too early"),
    compatibility: z.number().min(0).max(100),
  }),
  suggestedStage: z
    .enum(["new", "chatting", "warm", "date_proposed", "date_set", "cold", "passed"])
    .describe("Pipeline stage after this message is sent"),
});

const SYSTEM = `You are the Conversation agent for a dating wingman. You write the user's next message to a match, in the user's own voice, and keep the CRM record for that match up to date.

Rules for the message:
- Sound exactly like the user's texting samples. Same casing, same energy. Never sound like an assistant. The samples show rhythm, not lines to reuse; don't copy their phrasing.
- Build on what the match actually said. Ask a real question or share something real; do not interrogate.
- Follow the user's conversation style guidance and their goal.
- Escalate naturally: once there's a shared interest and 2+ good exchanges, propose a specific, low-pressure meetup tied to that interest. If they accept, lock in a concrete time/place. Do not propose a date in the first message.
- If the match reveals a dealbreaker or is clearly not interested, write a short, kind wind-down message and set stage to "cold".
- Never lie about the user, never make promises they haven't made, never be manipulative or pushy.

Rules for the CRM: be factual and grounded in the transcript. Sentiment must reflect the match's messages, not the user's hopes.

Stage guidance: "chatting" = messages flowing; "warm" = clear mutual interest; "date_proposed" = a meetup has been suggested and not yet confirmed; "date_set" = time and place agreed; "cold" = fizzled or wound down.`;

export interface ChatResult {
  reply: string;
  rationale: string;
  crm: CrmFields;
  suggestedStage: Stage;
}

export async function draftReply(
  user: UserProfile,
  prefs: Preferences,
  c: PublicCandidate,
  m: Match,
): Promise<ChatResult> {
  if (!hasClaude()) return mockDraft(c, m);
  const out = await structured({
    schema: ChatOutput,
    system: SYSTEM,
    effort: "medium",
    user: `## The user\n${describeUser(user)}\n\n## Their preferences\n${describePrefs(prefs)}\n\n## Match profile\n${describeCandidate(c)}\n\n## Current stage: ${m.stage}\n## Current CRM notes\n${m.crm.summary || "(none yet)"}\n\n## Conversation so far\n${transcript(m, user.name, c.name)}\n\nWrite ${user.name}'s next message and update the CRM.`,
  });
  return out;
}

function mockDraft(c: PublicCandidate, m: Match): ChatResult {
  const userTurns = m.messages.filter((x) => x.from === "user").length;
  const last = [...m.messages].reverse().find((x) => x.from === "match")?.text ?? "";
  const shared = c.interests[0] ?? "that";
  let reply: string;
  let stage: Stage = "chatting";
  let sentiment: CrmFields["sentiment"] = "neutral";
  if (userTurns === 0) {
    reply = `ok "${c.prompts[0]?.a.slice(0, 40) ?? c.bio.slice(0, 40)}..." is a strong opener. what's the story there?`;
    stage = "new";
  } else if (userTurns === 1) {
    reply = `haha fair. so how deep does the ${shared} thing go, casual or full commitment?`;
    sentiment = "warm";
  } else if (userTurns === 2) {
    reply = `ok you've convinced me. there's a spot near campus that does ${shared}-adjacent things, thursday after 6?`;
    stage = "date_proposed";
    sentiment = "warm";
  } else if (/yes|sure|down|sounds|love|let's|ok/i.test(last)) {
    reply = `sick, thursday 6:30 it is. I'll send the pin`;
    stage = "date_set";
    sentiment = "hot";
  } else {
    reply = `no stress, another time then. how was the rest of your week?`;
    stage = "cold";
    sentiment = "cold";
  }
  return {
    reply,
    rationale: "Mock mode: canned escalation ladder (set ANTHROPIC_API_KEY for real drafts).",
    crm: {
      summary: `${c.name}, ${c.age}, ${c.job}. Talking about ${shared}. ${userTurns + 1} messages in.`,
      interests: c.interests,
      vibe: "mock: friendly",
      sentiment,
      redFlags: [],
      greenFlags: shared ? [`into ${shared}`] : [],
      nextStep: stage === "date_set" ? "Send location pin" : stage === "date_proposed" ? "Wait for reply on Thursday" : "Keep the thread going",
      dateIdea: `${shared} near campus`,
      compatibility: m.score,
    },
    suggestedStage: stage,
  };
}
