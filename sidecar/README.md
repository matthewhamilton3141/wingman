# Hinge sidecar

Hinge has no web app or API, so Wingman drives the real thing: this process
watches the **iPhone Mirroring** window on your Mac, reads it with Claude
vision, and taps/types into it. The Next.js app talks to it over HTTP and never
knows the difference between this and the simulator.

```
Wingman (PLATFORM=hinge) ──HTTP──▶ sidecar/server.ts ──screencapture──▶ iPhone Mirroring window
                                        │   ▲                                   ▲
                                        │   └── Claude vision (what's on screen, │ CGEvent taps / keys
                                        │       where are the buttons)          │ via sidecar/native
                                        └───────────────────────────────────────┘
```

## Setup (one time)

1. macOS 15+ with iPhone Mirroring paired to your iPhone. Open **iPhone
   Mirroring**, unlock the phone, open Hinge on the Discover tab.
2. Give your terminal app two permissions in **System Settings → Privacy &
   Security**: **Screen Recording** (for screenshots) and **Accessibility** (for
   taps and typing). You'll be prompted the first time; re-run after granting.
3. Claude: either `ANTHROPIC_API_KEY` in `.env.local`, or be logged in to Claude
   Code (the sidecar uses the same backend selection as the app).

## Run

```bash
npm run sidecar      # http://127.0.0.1:4747 — prints a health check on start
npm run dev:hinge    # the app, with PLATFORM=hinge
```

Open the **Phone** tab in Wingman to see the mirrored screen, the health
checks and the sidecar log. Then "Run cycle": the scout reads the profile on
screen, scores it, and likes (with the opener as the like comment) or passes;
matches are pulled from the Matches tab and their threads imported; the chat
agent drafts replies, and in Autopilot sends them.

## API

| Route             | Body                          | Does                                                         |
|-------------------|-------------------------------|--------------------------------------------------------------|
| `GET /health`     |                               | window, permissions, backend, what it last saw               |
| `GET /screen.png` |                               | live screenshot of the phone                                 |
| `GET /inspect`    |                               | what Claude sees on the current screen (debugging)           |
| `POST /discover`  |                               | scrolls through the profile on Discover, returns it          |
| `POST /like`      | `{candidateId, comment?}`     | taps the heart, adds the comment, sends the like             |
| `POST /pass`      | `{candidateId}`               | taps the X                                                   |
| `POST /matches`   |                               | conversations on the Matches tab                             |
| `POST /thread`    | `{name}`                      | opens that chat and transcribes it                           |
| `POST /send`      | `{name, text}`                | types and sends a message in that chat                       |
| `POST /tap`       | `{x, y}` (screenshot pixels)  | debug                                                        |
| `POST /scroll`    | `{fraction}`                  | debug                                                        |
| `POST /type`      | `{text}`                      | debug                                                        |

`like`/`pass` refuse to act unless the `candidateId` is the profile the sidecar
last read, so a stale cycle can never swipe on the wrong person. All phone work
is serialized: concurrent requests queue.

## Caveats

- Hinge's terms prohibit automation. This is a hackathon demo on your own
  account; run it in Approve mode and watch it.
- Every read is a vision call; a discover+like round trip is ~4 calls, a chat
  check is ~3. It's slow (10-40 s per action) and Hinge UI changes can break the
  layout hints in `vision.ts`'s system prompt.
- The mirroring window must stay on screen (not minimized, not covered is
  fine — it captures the window, not the screen region).
