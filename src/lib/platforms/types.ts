import type { Candidate, Match, UserProfile } from "../types";

/**
 * A dating platform connector. Two implementations: the simulator (personas
 * played by Claude) and Hinge, driven through iPhone Mirroring by the sidecar
 * in /sidecar. The agents and CRM never depend on where matches come from.
 */
export interface DatingPlatform {
  name: string;
  /** Candidates the user hasn't acted on yet. Hinge yields the one profile on screen. */
  discover(seen: Set<string>): Promise<Candidate[]>;
  /** Like a candidate; `comment` rides along as the like comment where the platform supports it. */
  like(candidate: Candidate, comment?: string): Promise<{ matched: boolean; commented?: boolean }>;
  pass(candidate: Candidate): Promise<void>;
  /**
   * Wait for the match's next message. Empty text means they didn't reply;
   * `pending` means "no reply *yet*" and must not count as a ghost.
   */
  awaitReply(user: UserProfile, candidate: Candidate, match: Match): Promise<{ text: string; acceptsDate: boolean; pending?: boolean }>;
  /** Real platforms: actually deliver a message. The simulator just records it. */
  send?(candidate: Candidate, match: Match, text: string): Promise<void>;
  /** Real platforms: matches that exist on the platform right now (matching is asynchronous there). */
  matches?(): Promise<{ name: string; preview: string; yourTurn: boolean }[]>;
  /** Real platforms: the visible thread, used to import matches that pre-date Wingman. */
  thread?(candidate: Candidate): Promise<{ from: "user" | "match"; text: string }[]>;
}
