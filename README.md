# Wingman

Agents work your dating apps; you approve the good parts. Everything lands in a CRM.

- **Scout** reads each new profile against your preferences, scores it, likes or passes, and writes an opener.
- **Chat** writes replies in your voice from your real message samples, and keeps a CRM record per match (read on them, flags, next step, date idea).
- **Persona** plays the matches in the simulated platform so you can demo the whole loop without a real account.

Modes: **Approve** (agent drafts, you send) or **Autopilot** (agent sends).

## Run

```bash
npm install
npm run dev
```

No API key needed: if you're logged into Claude Code, the agents run through that login via the Claude Agent SDK. Set `ANTHROPIC_API_KEY` in `.env` to use the API directly instead, or `LLM_BACKEND=mock` for canned output.

Open http://localhost:3000 and hit **Run cycle**. Each cycle scores unreviewed profiles and advances every active thread one step. **Keep running** loops it.

## Layout

- `src/lib/agents/` – scout, chat, persona (Claude Opus 5 via structured outputs; mock fallback without a key)
- `src/lib/platforms/` – `DatingPlatform` interface + simulated implementation. A Hinge connector would go here.
- `src/lib/pipeline.ts` – one cycle: discover → score → like → advance threads
- `src/app/api/` – state, cycle, mode, preferences, match actions
- `src/components/` – pipeline board, match detail with draft approval, discovery, preferences, activity
- `data/db.json` – local state (gitignored)
