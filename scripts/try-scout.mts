import { scoreCandidate } from "../src/lib/agents/scout";
import { seedCandidates, seedPreferences, seedUser } from "../src/lib/seed";
const t = Date.now();
const r = await scoreCandidate(seedUser, seedPreferences, seedCandidates[4]);
console.log(JSON.stringify(r, null, 2), `${((Date.now() - t) / 1000).toFixed(1)}s`);
