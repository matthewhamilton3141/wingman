import type { Candidate, Preferences, UserProfile } from "./types";

export const seedUser: UserProfile = {
  name: "Matt",
  age: 19,
  city: "Waterloo",
  bio: "SYDE at Waterloo. Build things for fun (a menu-bar notch app, a laser tag game). Ultimate frisbee, long walks with a podcast, will absolutely debate the best ramen spot.",
  interests: ["building side projects", "ultimate frisbee", "ramen", "podcasts", "hiking", "board games"],
  voiceSamples: [
    "ok the fact that you have a strong opinion on ramen already puts you ahead of most people",
    "haha no way, I've been meaning to try that trail. what's the move, sunrise or sunset hike?",
    "honestly building it was the easy part, getting anyone to use it was the hard part lol",
    "that's a bold take and I respect it",
  ],
};

export const seedPreferences: Preferences = {
  ageRange: [18, 24],
  maxDistanceKm: 40,
  goal: "Something real but low-pressure. Wants to actually meet up, not pen-pal forever.",
  mustHaves: ["has their own thing going on (hobby, project, sport)", "can hold a conversation", "kind"],
  dealbreakers: ["only wants a hookup", "smokes", "rude to service workers", "no hobbies at all"],
  niceToHaves: ["outdoorsy", "into games", "curious about tech", "student"],
  tone: "Casual, playful, lowercase-ish, light teasing. Ask real questions. Never cheesy pickup lines. Suggest meeting up once there's a shared interest and a few good exchanges.",
  likeThreshold: 65,
};

export const seedCandidates: Candidate[] = [
  {
    id: "c1", name: "Priya", age: 20, distanceKm: 3, job: "CS student",
    bio: "Third year CS. I will beat you at Catan. Weekend climber, weekday bubble-tea enthusiast.",
    interests: ["board games", "bouldering", "bubble tea", "anime"],
    prompts: [
      { q: "A shower thought I recently had", a: "Rock climbing is just aggressive yoga with consequences." },
      { q: "We'll get along if", a: "you don't flip the board when you lose." },
    ],
    persona: { temperament: "witty, competitive, warm once engaged", texting: "quick, jokes, emojis rarely", openness: 0.8 },
  },
  {
    id: "c2", name: "Sofia", age: 22, distanceKm: 12, job: "Nursing student",
    bio: "Trail runs, farmers markets, and a strong belief that breakfast for dinner is elite.",
    interests: ["running", "cooking", "hiking", "dogs"],
    prompts: [
      { q: "My simple pleasures", a: "Sunday morning market runs and a dog that isn't mine." },
      { q: "Dating me is like", a: "having a personal hype woman who also makes you go on hikes." },
    ],
    persona: { temperament: "kind, upbeat, a bit slow to reply because of shifts", texting: "friendly, exclamation points, asks questions back", openness: 0.7 },
  },
  {
    id: "c3", name: "Jade", age: 21, distanceKm: 6, job: "Bartender",
    bio: "Here for a good time not a long time 😉",
    interests: ["nightlife", "concerts", "tattoos"],
    prompts: [
      { q: "Looking for", a: "something casual, no strings" },
      { q: "Green flags", a: "buys the first round" },
    ],
    persona: { temperament: "flirty, blunt", texting: "short, direct, emoji heavy", hiddenDealbreaker: "explicitly only wants a hookup", openness: 0.9 },
  },
  {
    id: "c4", name: "Hannah", age: 23, distanceKm: 28, job: "Junior UX designer",
    bio: "I design apps by day and judge them by night. Pottery beginner. Owns too many plants.",
    interests: ["design", "pottery", "plants", "coffee", "indie games"],
    prompts: [
      { q: "I geek out on", a: "onboarding flows. Yes really. Show me your side project and I'll roast it lovingly." },
      { q: "Ideal first date", a: "A walk somewhere with good coffee and a plant shop on the way." },
    ],
    persona: { temperament: "curious, thoughtful, dry humor", texting: "full sentences, thoughtful questions, warms up slowly", openness: 0.6 },
  },
  {
    id: "c5", name: "Mei", age: 19, distanceKm: 2, job: "Engineering student",
    bio: "Mech eng. Ultimate frisbee intramurals, badly. Will trade you ramen recs for hiking recs.",
    interests: ["ultimate frisbee", "ramen", "hiking", "photography"],
    prompts: [
      { q: "Best travel story", a: "Got lost in Kyoto and found the best ramen of my life. Worth it." },
      { q: "Together we could", a: "actually finish a 1000-piece puzzle." },
    ],
    persona: { temperament: "easygoing, enthusiastic, a little shy at first", texting: "lowercase, lol, sends recs", openness: 0.85 },
  },
  {
    id: "c6", name: "Taylor", age: 24, distanceKm: 55, job: "Sales",
    bio: "Work hard play hard. Gym 6 days. Don't waste my time.",
    interests: ["gym", "cars", "clubs"],
    prompts: [
      { q: "Don't hate me if I", a: "vape." },
      { q: "I'm weirdly attracted to", a: "people who respond fast." },
    ],
    persona: { temperament: "impatient, transactional", texting: "one-liners, gets bored fast", hiddenDealbreaker: "vapes, treats waiters badly", openness: 0.3 },
  },
  {
    id: "c7", name: "Ava", age: 20, distanceKm: 9, job: "Bio student",
    bio: "Plant bio. Will ID every tree on our walk whether you like it or not. Cozy game enjoyer.",
    interests: ["hiking", "stardew valley", "baking", "birds"],
    prompts: [
      { q: "Unusual skill", a: "I can tell you the tree by the bark. Yes it works at parties. No it doesn't." },
      { q: "Typical Sunday", a: "Bake something, hike something, then Stardew until I forget the bread in the oven." },
    ],
    persona: { temperament: "gentle, nerdy, talks a lot when comfortable", texting: "medium length, lots of enthusiasm, occasional typos", openness: 0.75 },
  },
  {
    id: "c8", name: "Chloe", age: 26, distanceKm: 15, job: "Accountant",
    bio: "Looking for something serious. Ready to settle down. Must want kids within 2 years.",
    interests: ["wine", "brunch", "travel"],
    prompts: [
      { q: "I'm looking for", a: "marriage material. Not here to play." },
      { q: "Dealbreakers", a: "students." },
    ],
    persona: { temperament: "serious, direct", texting: "formal, asks about career plans", openness: 0.4 },
  },
];
