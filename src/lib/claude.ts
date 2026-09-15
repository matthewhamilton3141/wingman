import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5";

/**
 * Which brain the agents use, in order of preference:
 *  - "api"       ANTHROPIC_API_KEY is set → Claude API directly
 *  - "agent-sdk" no key, but Claude Code is logged in → Claude Agent SDK rides that login
 *  - "mock"      neither → canned heuristics so the demo still runs
 * Set LLM_BACKEND to force one.
 */
export type Backend = "api" | "agent-sdk" | "mock";
export function backend(): Backend {
  const forced = process.env.LLM_BACKEND as Backend | undefined;
  if (forced) return forced;
  if (process.env.ANTHROPIC_API_KEY) return "api";
  if (process.env.WINGMAN_NO_AGENT_SDK) return "mock";
  return "agent-sdk";
}
export const hasClaude = () => backend() !== "mock";

let _client: Anthropic | undefined;
function client() {
  return (_client ??= new Anthropic());
}

interface Opts<S extends z.ZodType> {
  schema: S;
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
}

/**
 * One structured call. Every agent goes through here so the request shape
 * (model, thinking, effort, refusal fallbacks) lives in one place.
 */
export async function structured<S extends z.ZodType>(opts: Opts<S>): Promise<z.infer<S>> {
  return backend() === "agent-sdk" ? viaAgentSdk(opts) : viaApi(opts);
}

async function viaApi<S extends z.ZodType>(opts: Opts<S>): Promise<z.infer<S>> {
  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "low",
      format: betaZodOutputFormat(opts.schema),
    },
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
  });
  if (res.stop_reason === "refusal") {
    throw new Error(`Claude refused: ${res.stop_details?.explanation ?? "no explanation"}`);
  }
  if (!res.parsed_output) throw new Error("Claude returned no parseable output");
  return res.parsed_output;
}

async function viaAgentSdk<S extends z.ZodType>(opts: Opts<S>): Promise<z.infer<S>> {
  // Lazy import: the SDK spawns the local `claude` binary, only needed on this path.
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  // Claude Code's validator rejects the draft-2020-12 `$schema` pointer zod emits.
  const { $schema: _, ...schema } = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  void _;
  const run = query({
    prompt: opts.user,
    options: {
      model: MODEL,
      systemPrompt: { type: "custom", prompt: opts.system },
      outputFormat: { type: "json_schema", schema },
      tools: [],
      maxTurns: 2,
      effort: opts.effort ?? "low",
      permissionMode: "bypassPermissions",
      settingSources: [],
    },
  });
  for await (const msg of run) {
    if (msg.type !== "result") continue;
    if (msg.subtype !== "success") {
      throw new Error(`Agent SDK: ${msg.subtype}${"errors" in msg && Array.isArray(msg.errors) ? ` – ${msg.errors.join("; ")}` : ""}`);
    }
    return opts.schema.parse(msg.structured_output);
  }
  throw new Error("Agent SDK returned no result");
}
