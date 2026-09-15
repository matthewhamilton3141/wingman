export type Stage =
  | "new"
  | "chatting"
  | "warm"
  | "date_proposed"
  | "date_set"
  | "cold"
  | "passed";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "new", label: "New match" },
  { id: "chatting", label: "Chatting" },
  { id: "warm", label: "Warm" },
  { id: "date_proposed", label: "Date proposed" },
  { id: "date_set", label: "Date set" },
  { id: "cold", label: "Cold" },
  { id: "passed", label: "Passed" },
];

export type Mode = "approve" | "autopilot";

export interface UserProfile {
  name: string;
  age: number;
  city: string;
  bio: string;
  interests: string[];
  /** Real messages the user has written, so the agent can match their voice. */
  voiceSamples: string[];
}

export interface Preferences {
  ageRange: [number, number];
  maxDistanceKm: number;
  goal: string;
  mustHaves: string[];
  dealbreakers: string[];
  niceToHaves: string[];
  /** Free-text guidance for the conversation agent. */
  tone: string;
  /** Score threshold (0-100) at or above which the scout will like a candidate. */
  likeThreshold: number;
}

export interface Candidate {
  id: string;
  name: string;
  age: number;
  distanceKm: number;
  /** Real platforms show a place rather than a distance. */
  location?: string;
  job: string;
  bio: string;
  interests: string[];
  prompts: { q: string; a: string }[];
  /** Only the simulator sees this; it drives how the persona behaves. */
  persona: {
    temperament: string;
    texting: string;
    hiddenDealbreaker?: string;
    openness: number; // 0-1, how easily they warm up
  };
}

export interface Scored {
  candidateId: string;
  score: number;
  decision: "like" | "pass";
  reasons: string[];
  concerns: string[];
  opener?: string;
  at: string;
}

export interface Message {
  id: string;
  from: "user" | "match";
  text: string;
  at: string;
  sentBy: "agent" | "human" | "persona";
}

export interface Draft {
  text: string;
  rationale: string;
  at: string;
  /** CRM update and stage that get applied when the draft is sent. */
  crm: CrmFields;
  stage: Stage;
}

export interface CrmFields {
  summary: string;
  interests: string[];
  vibe: string;
  sentiment: "cold" | "neutral" | "warm" | "hot";
  redFlags: string[];
  greenFlags: string[];
  nextStep: string;
  dateIdea?: string;
  compatibility: number;
}

export interface Match {
  id: string;
  candidateId: string;
  stage: Stage;
  score: number;
  messages: Message[];
  draft?: Draft;
  crm: CrmFields;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentName = "scout" | "chat" | "persona" | "system";

export interface Activity {
  id: string;
  at: string;
  agent: AgentName;
  text: string;
  matchId?: string;
  candidateId?: string;
}

export interface State {
  user: UserProfile;
  preferences: Preferences;
  mode: Mode;
  candidates: Candidate[];
  scored: Record<string, Scored>;
  matches: Match[];
  activity: Activity[];
  running: boolean;
  lastCycleAt?: string;
  llm: "api" | "agent-sdk" | "mock";
  /** Where matches come from: the simulator or the real app via the sidecar. */
  platform: "SimDate" | "Hinge";
}

/** What the browser sees: candidates minus their hidden persona. */
export type PublicCandidate = Omit<Candidate, "persona">;
export type PublicState = Omit<State, "candidates"> & {
  candidates: PublicCandidate[];
};
