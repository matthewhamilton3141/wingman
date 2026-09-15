// Claude vision over phone screenshots. Every read of the screen goes through
// `see()`, which returns a zod-validated object.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { z } from "zod";
import { backend, MODEL } from "../src/lib/claude.ts";

/** Same brain selection as the app: API key → Claude API; else the Claude Agent SDK on the local login. */
export const hasClaude = () => backend() !== "mock";

let _client: Anthropic | undefined;
const client = () => (_client ??= new Anthropic());

const SYSTEM = `You are the eyes of a dating-app sidecar. You are shown screenshots of the Hinge iOS app, captured from an iPhone Mirroring window on a Mac, and you answer with structured data only.

Coordinates: whenever you report a tap target, give the pixel coordinates of the CENTER of that element in the image as it was given to you (origin top-left, x to the right, y downward). Be precise; a tap lands exactly where you say.

Hinge layout hints (may vary slightly by version):
- Bottom tab bar, left to right: Discover (Hinge "H" logo), Standouts (sparkle/star), Likes You (heart), Matches (speech bubbles), Profile (person). The selected tab is filled/darker.
- Discover: one profile at a time as a long vertical card mixing photos and prompt cards ("question" in small text, answer in large text). Each photo and prompt has its own small round heart button (bottom-right of that item). A round X button sits fixed at the bottom-left of the screen. A rose button may sit at the bottom-right. The person's name (sometimes with a verification check) is near the top; age, height, location, job, school and intent chips are in a "vitals" section.
- Tapping a heart opens a bottom sheet with an optional comment field ("Add a comment") and a large "Send Like" button. Sending a like advances to the next profile.
- Liking someone who already liked you shows a full-screen "It's a match" celebration with a way to message or dismiss.
- Matches tab: a horizontal row of new matches at the top, then a list of conversations (avatar, name, last message preview, sometimes a "Your turn" badge). Tapping a row opens the chat.
- Chat: match name at top with a back arrow at top-left; their messages are grey bubbles on the left, the user's are coloured bubbles on the right; a text field ("Send a message" / "Type a message") sits at the bottom with a send button (arrow) that appears once text is entered.
- Paywalls, "out of likes", rating prompts and permission dialogs can appear at any time; report them so they can be dismissed.`;

/** One structured vision call. `frames` are PNG buffers, shown in order before the prompt. */
export async function see<S extends z.ZodType>(opts: {
  frames: Buffer[];
  schema: S;
  prompt: string;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  if (!hasClaude()) throw new Error("The Hinge sidecar needs Claude vision: set ANTHROPIC_API_KEY or log in to Claude Code");
  const content: BetaContentBlockParam[] = opts.frames.map((png) => ({
    type: "image",
    source: { type: "base64", media_type: "image/png", data: png.toString("base64") },
  }));
  content.push({ type: "text", text: opts.prompt });
  if (backend() === "agent-sdk") return viaAgentSdk(content, opts.schema, opts.effort ?? "low");
  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error(`Claude refused: ${res.stop_details?.explanation ?? "no explanation"}`);
  if (!res.parsed_output) throw new Error("Claude returned no parseable output");
  return res.parsed_output;
}

/** Mirrors viaAgentSdk in src/lib/claude.ts, but with image blocks in the prompt. */
async function viaAgentSdk<S extends z.ZodType>(content: BetaContentBlockParam[], schema: S, effort: "low" | "medium" | "high"): Promise<z.infer<S>> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _;
  async function* prompt() {
    yield {
      type: "user" as const,
      message: { role: "user" as const, content: content as never },
      parent_tool_use_id: null,
      session_id: "",
    };
  }
  const run = query({
    prompt: prompt(),
    options: {
      model: MODEL,
      systemPrompt: { type: "custom", prompt: SYSTEM },
      outputFormat: { type: "json_schema", schema: jsonSchema },
      tools: [],
      maxTurns: 2,
      effort,
      permissionMode: "bypassPermissions",
      settingSources: [],
    },
  });
  for await (const msg of run) {
    if (msg.type !== "result") continue;
    if (msg.subtype !== "success") {
      throw new Error(`Agent SDK: ${msg.subtype}${"errors" in msg && Array.isArray(msg.errors) ? ` – ${msg.errors.join("; ")}` : ""}`);
    }
    return schema.parse(msg.structured_output);
  }
  throw new Error("Agent SDK returned no result");
}

// ---- Schemas -------------------------------------------------------------

const Point = z.object({ x: z.number(), y: z.number() });
const Target = Point.extend({ visible: z.boolean().describe("false if the element is not on screen; then x/y are 0") });

export const Screen = z.enum([
  "discover",
  "like_sheet",
  "its_a_match",
  "matches",
  "chat",
  "likes_you",
  "standouts",
  "profile",
  "paywall",
  "dialog",
  "loading",
  "other",
]);
export type ScreenName = z.infer<typeof Screen>;

export const Inspect = z.object({
  screen: Screen.describe("Which Hinge screen this is"),
  description: z.string().describe("One sentence describing what is on screen"),
  tabs: z.object({
    discover: Target,
    likesYou: Target,
    matches: Target,
  }).describe("Bottom tab bar buttons"),
  profileName: z.string().describe("On discover/like_sheet/its_a_match/chat: the other person's first name as shown; else empty"),
  closeButton: Target.describe("The round X (pass) button on Discover"),
  likeButton: Target.describe("The FIRST visible heart button on the profile card (bottom-right of a photo or prompt), if any"),
  sendLikeButton: Target.describe("The big 'Send Like' button on the like sheet"),
  commentField: Target.describe("The 'Add a comment' text field on the like sheet"),
  backButton: Target.describe("Back arrow at the top-left (chat and sub-screens)"),
  messageField: Target.describe("The message text field at the bottom of a chat"),
  sendButton: Target.describe("The send (arrow) button next to the message field, if visible"),
  dismiss: Target.describe("On paywall/dialog/its_a_match/other: the control that closes it (X, 'Not now', 'Maybe later', 'Close'), if any"),
  conversations: z
    .array(z.object({ name: z.string(), preview: z.string(), yourTurn: z.boolean(), x: z.number(), y: z.number() }))
    .describe("On the matches screen: the conversation rows visible in the list, top to bottom, with the center of each row. Empty elsewhere."),
});
export type InspectResult = z.infer<typeof Inspect>;

export const Profile = z.object({
  name: z.string(),
  age: z.number().describe("0 if not shown"),
  location: z.string().describe("City / neighbourhood as shown, or empty"),
  distanceKm: z.number().describe("Distance in km if shown, else 0"),
  job: z.string().describe("Job and/or school as shown, or empty"),
  bio: z.string().describe("A 1-2 sentence summary of who they are, written from what is visible (vitals, prompts, photos). Never invent facts."),
  interests: z.array(z.string()).describe("Interests inferred from prompts, chips and photos; 3-6 short items"),
  prompts: z.array(z.object({ q: z.string(), a: z.string() })).describe("Every prompt card visible across the frames, question and full answer, deduplicated"),
  vitals: z.array(z.string()).describe("Chips from the vitals section: height, intent, drinking, kids, religion, etc."),
  reachedEnd: z.boolean().describe("true if the last frame shows the bottom of the profile (e.g. the last prompt/photo followed by the bottom of the card)"),
});
export type ProfileResult = z.infer<typeof Profile>;

export const Thread = z.object({
  name: z.string().describe("The match's name from the chat header"),
  messages: z
    .array(z.object({ from: z.enum(["user", "match"]), text: z.string() }))
    .describe("Every message bubble visible across the frames, oldest first, deduplicated across overlapping frames. 'user' = right-aligned coloured bubbles (the phone owner); 'match' = left-aligned grey bubbles. Include the like comment shown at the top if any."),
  theirTurn: z.boolean().describe("true if the most recent message is from the user (waiting on the match)"),
});
export type ThreadResult = z.infer<typeof Thread>;
