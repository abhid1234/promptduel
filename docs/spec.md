# Spec — PromptDuel v1

**Status:** Phase 0 complete (design + scaffold). Phase 1 (dual-model load + streaming) is the next milestone.
**Owner:** Abhi Das
**Project:** CC in `RL & Agentic AI Project Pipeline` tracker
**Lives at:** `duel.ondeviceml.space` (25th lane of ondeviceml.space)

## What this is

A web app where two small open-weight LLMs run in parallel WebGPU contexts inside the user's browser, debate a user-supplied topic with adversarial system prompts, stream responses side-by-side over 3 rounds, and the user votes who won. Zero compute cost, zero ongoing cost, on-device for inference, viral-content-engine UX.

## User story

> As a curious visitor to ondeviceml.space, I want to type a topic and watch two small AIs argue both sides of it live in my browser, then vote on who won, and share the link with a colleague. I want the whole thing to run on my phone with no account and no cloud calls.

## Architecture (the whole thing in one diagram)

```
[ User types topic ]
        ↓
[ Frontend assigns positions ]
   → Gemma 4 270M IT: defend YES
   → Qwen 2.5 0.5B: defend NO
        ↓
[ Round 1: OPENING ]
   Both stream concurrently into 2 columns
   System prompt forces position commitment
        ↓
[ Round 2: REBUTTAL ]
   Each model reads opponent's R1 response
   Generates targeted counter-points
        ↓
[ Round 3: CLOSING ]
   Each model makes final case
        ↓
[ User votes ] → [ Permalink stored on Cloudflare Worker + KV ]
        ↓
[ Share button → URL is the marketing artifact ]
```

## Models (locked for v1)

| Model | Size (int4) | Role | Why |
|---|---|---|---|
| Gemma 4 270M IT | ~150MB | Stream A (defend YES) | Smallest viable, Google's safety-tuned tone gives distinct personality |
| Qwen 2.5 0.5B | ~300MB | Stream B (defend NO) | Slightly bigger, more direct/spicy tone — personality contrast is visible |
| **Total memory budget** | **~450MB** | | Safe on most phones (per `feedback_machine_memory.md`) |

**Why not 2× Gemma:** they hedge too much, sound the same. Cross-vendor pairing is the secret sauce.
**Why not 2× 1.5B:** ~1.6-2GB combined exceeds safe mobile WebGPU budget. v2 maybe; v1 stays safe.

## Adversarial prompt template (the secret of why this works)

Small models love to hedge. The prompt MUST force commitment. Template:

```
You are debating in a structured duel. You MUST argue ONLY for: {POSITION}.

Rules:
- You are NEVER neutral. NEVER say "I respect your perspective" or "both sides have merit."
- You MUST attack specific points the other model made (when applicable).
- You MUST commit to your assigned position even if you doubt it.
- Stay civil — no insults, no slurs. Sharp disagreement is fine and expected.
- Keep responses to 120-180 words.
- This is round {N} of 3: {ROUND_INSTRUCTION}

Topic: {TOPIC}
{OPPONENT_LAST_MESSAGE_IF_APPLICABLE}

Your argument:
```

`ROUND_INSTRUCTION` by round:
- R1 (opening): "Make your strongest opening case. Stake out your position with 2-3 concrete points."
- R2 (rebuttal): "Read the opponent's opening above. Pick 1-2 of their strongest points and dismantle them. End with one counter-argument."
- R3 (closing): "Make your final case. Why is your position correct despite the opponent's challenge? End on conviction."

**Test this template HEAVILY in Phase 1.** Small models still find creative ways to hedge. Tune the "you are NEVER neutral" line aggressively until 90%+ of generations stay committed.

## File scaffolding (Phase 1)

```
app/
├── src/
│   ├── lib/
│   │   ├── models.ts        # Transformers.js loaders for both models
│   │   ├── duel.ts          # 3-round orchestrator, manages parallel streams
│   │   ├── prompts.ts       # adversarial template + round instructions
│   │   └── storage.ts       # CF Worker + KV adapter for permalinks
│   ├── components/
│   │   ├── TopicInput.tsx
│   │   ├── DebateColumn.tsx     # one model's streaming column (used 2×)
│   │   ├── RoundIndicator.tsx
│   │   ├── VoteBar.tsx
│   │   └── ShareButton.tsx
│   ├── pages/
│   │   ├── Home.tsx             # topic entry, model picker (default Gemma vs Qwen)
│   │   ├── Duel.tsx             # the active streaming duel view
│   │   └── DuelPermalink.tsx    # /duel/:id — re-runs a saved duel
│   └── App.tsx
├── public/
│   └── manifest.json
└── package.json
```

```
worker/
├── src/
│   └── index.ts         # POST /api/save-duel, GET /api/duel/:id, POST /api/vote
├── wrangler.toml
└── package.json
```

## Phase plan (mirrors STATUS.md, more detailed here)

| Phase | Scope | Time | Acceptance |
|-------|-------|------|------------|
| 1 | Vite + Transformers.js. Load both models concurrently. Simple UI with topic input + 2 streaming columns. Hardcoded prompt template. | ~1 weekend | Type a topic, see both models stream into their columns at the same time, no crashes, works on phone WebGPU |
| 2 | 3-round orchestration. Vote bar. Cloudflare Worker + KV for permalinks. "Share this duel" button. | ~half weekend | Complete full duel, vote, share URL, friend opens URL on different device and sees the same duel re-run |
| 3 | Mobile polish. Touch-friendly vote UI. 12 curated topic suggestions. Deploy to duel.ondeviceml.space. Demo video. Launch on LinkedIn + X. | ~half weekend | Live at duel.ondeviceml.space, 12 sample duels permalinked for the launch post |
| 4 (v2, opportunistic) | Tournament bracket. Judge mode. Personality cards. | +1-2 weekends each | Each is a separate viral launch post |
| 5 (v3, opportunistic) | Audio narration via Web Speech API. Live audience real-time voting via CF Workers WebSocket. | +1-2 weekends each | Each is a separate viral launch post |

## Acceptance criteria for v1 launch

- ✅ Type a topic, both models stream into side-by-side columns concurrently
- ✅ 3 rounds complete (opening → rebuttal → closing)
- ✅ Vote button records winner; permalink stored on CF Worker + KV
- ✅ "Share this duel" generates a URL that re-runs the same duel
- ✅ Works on Chromebook + Chrome mobile + iPhone Safari (with graceful WebGL fallback if dual-model fails)
- ✅ No outbound traffic during a duel (verifiable in browser dev tools network tab)
- ✅ <5 sec from "Start Duel" to first token streaming
- ✅ Topic moderation: basic profanity filter + "report this duel" link
- ✅ Deploys to duel.ondeviceml.space without affecting the other 24 ondeviceml.space lanes
- ✅ 12 curated sample duels permalinked and shareable for the launch post

## Out of scope for v1 (defer to v2-v3)

- Tournament mode (8-topic bracket) — v2
- Judge mode (third model scores objectively) — v2
- Personality cards (Gemma=optimist, Qwen=doomer presets) — v2
- Audio narration (Web Speech API reads both columns) — v3
- Live audience real-time voting (multiple visitors voting on same duel) — v3
- Custom debate-specialized model training — v∞
- Cloud-hosted larger models — never (defeats the on-device pitch)
- User accounts / saved history — never (privacy-pure)
- Monetization — never (this is a viral asset)

## Test prompts (use these in Phase 2 dev)

These are the prompts you should be testing against to make sure the adversarial system is working:

1. "Should AI write my LinkedIn posts?"
2. "Is vibe coding real engineering?"
3. "Should agents have permissions, or just do what they're told?"
4. "Is RAG dead?"
5. "Should startups build their own foundation model?"
6. "Will AGI arrive in 2027?"
7. "Is on-device AI actually better than cloud AI?"
8. "Should the EU AI Act be repealed?"
9. "Does open-source AI win in the long run?"
10. "Are personal AI agents the next OS?"
11. "Should I quit my job to start an AI startup?"
12. "Is voice the right primary interface for AI?"

If all 12 produce committed, on-position, non-hedging debates that feel entertaining, v1 is launch-ready.

## v2 / v3 roadmap (only ship after v1 validates)

**v2 — Format expansions (each +1-2 weekends, each its own viral post):**
- **Tournament mode** — 8 pre-seeded topics, models compete across all, crowd-voted leaderboard
- **Judge mode** — a third model (slightly larger, e.g., Llama 3.2 1B or Phi-4 Mini) scores who won each round objectively. "Even Gemma's own bigger brother thinks Qwen won this round."
- **Personality cards** — pre-configured archetypes: techno-optimist vs doomer, ML engineer vs sociologist, accelerationist vs decelerationist, etc.
- **Topic-of-the-day** — front page rotates a seeded topic daily, ties to Anti-gravity cron for full automation

**v3 — Engagement expansions:**
- **Audio narration** — Web Speech API reads both columns alternately. Becomes a podcast format.
- **Live audience** — multiple visitors voting on the same duel in real time via Cloudflare Workers WebSocket
- **Hot Take Generator** — Gemma picks the topic AND its own side. Pure chaos.

## Reference implementations to study

- **LMSys Chatbot Arena** — the UX template (you go cheaper + on-device + adversarial-by-design)
- **HuggingFace Transformers.js examples** — dual-model load pattern
- **Your existing ondeviceml.space `chat` lane** — for the model-loading + streaming pattern this project reuses
- **ondeviceml.space deployment pipeline** — for the routing/build/deploy reuse

## LinkedIn launch frame (drafts live OUTSIDE git per `feedback_social_posts_never_in_git.md`)

The launch positioning should make two things crisp:

1. **What it is:** "I made two open-weight AIs argue with each other. In your browser. No account, no cloud, on-device. Pick a topic, watch them duke it out, vote who won. Every duel has a permalink."
2. **What it's NOT:** "This is not LMSys Chatbot Arena (cloud benchmark). This is entertainment — small models, forced positions, debate format, share-friendly. Different intent."

Crisp positioning prevents the "this is just LMSys" critique and pulls the right audience (AI builders who enjoy AI-on-AI spectacle, not benchmarkers).
