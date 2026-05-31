# CLAUDE.md — promptduel project context

## What this is

**PromptDuel** — a cheap, fast, viral on-device demo where two small open-weight LLMs run in parallel WebGPU contexts inside a browser, debate a user-supplied topic with adversarial system prompts, stream responses side-by-side over 3 rounds, and the user votes who won. Every duel has a permalink. Lives at `duel.ondeviceml.space`. ZERO compute cost, ZERO ongoing cost. Fastest shippable cool project in the entire tracker.

Project CC in Abhi's `RL & Agentic AI Project Pipeline` tracker. The "ship between bigger projects for low-risk launch momentum" pick.

**Spec:** see `docs/spec.md`.
**Status:** see `STATUS.md`.

## v1 scope (locked from the original brief)

- Two models: **Gemma 4 270M IT** (~150MB int4) + **Qwen 2.5 0.5B** (~300MB int4). Total ~450MB — safe on most modern phones AND desktops.
- 3 rounds: opening → rebuttal → closing.
- Side-by-side streaming (both columns generate concurrently).
- Vote button + share permalink.
- Mobile-responsive PWA-style web app on `duel.ondeviceml.space`.
- Cloudflare Workers free tier for permalink + vote analytics.
- 1-2 weekends to ship v1.

## Hard constraints — DO NOT VIOLATE

1. **On-device inference only.** No cloud LLM calls in the hot path. The whole pitch is "in your browser." Cloud fallback would defeat the demo.
2. **Open-weight models only.** No proprietary APIs even at build time. Apache 2.0 or MIT only (Gemma 4, Qwen 2.5 both qualify).
3. **No new infrastructure costs.** Static hosting + Cloudflare Workers free tier ONLY. If you need more, redesign first.
4. **Per `feedback_odml_mediapipe_constraints.md`** — `self.import` breaks streaming/WebGPU/Workers. Stick with blob URL pattern when loading model files.
5. **Per `feedback_social_posts_never_in_git.md`** — no LinkedIn or Substack drafts in this repo. Launch posts live outside git.
6. **Per `feedback_no_employer_in_launch_materials.md`** — no Google Cloud / employer / 20% / colleague refs in any public launch artifact.
7. **Adversarial-by-design.** The whole point is the models DISAGREE. System prompts must FORCE commitment, not allow hedging. Small models love to sit on the fence — engineer them off it.
8. **Don't divert from N/O/P/K/L/M.** PromptDuel is a 1-2 weekend asset that ships BETWEEN larger projects. Don't let it grow into a 6-weekend epic.

## Architecture pointers

```
promptduel/
├── docs/
│   └── spec.md              # full v1 spec, adversarial prompt template, model details
├── app/                     # the web app (Phase 1)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── models.ts    # Transformers.js or MediaPipe model loaders
│   │   │   ├── duel.ts      # debate orchestration: rounds, streams, state
│   │   │   ├── prompts.ts   # adversarial system prompt templates
│   │   │   └── storage.ts   # Cloudflare Workers + KV adapter for permalinks
│   │   ├── components/
│   │   │   ├── TopicInput.tsx
│   │   │   ├── DebateColumn.tsx     # one model's streaming column
│   │   │   ├── VoteBar.tsx
│   │   │   └── ShareButton.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx             # topic entry, model picker
│   │   │   ├── Duel.tsx             # the streaming duel view
│   │   │   └── DuelPermalink.tsx    # re-run a saved duel by id
│   │   └── App.tsx
│   └── public/
│       └── manifest.json
├── worker/                  # Cloudflare Worker for permalinks + analytics
│   └── index.ts
└── package.json
```

**Stack:**
- Vite + React + TypeScript (mirror ondeviceml.space)
- Transformers.js (preferred for two-model load) OR MediaPipe `tasks-genai`
- Tailwind for styling
- Cloudflare Workers + KV for permalink storage (free tier handles 100K req/day)
- Deploys to `duel.ondeviceml.space` via your existing Vercel/Cloudflare Pages pipeline

## Common commands

```bash
cd ~/Core/Workspace/AntigravityCLI/promptduel
# Phase 1 setup:
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install @huggingface/transformers   # for the dual-model load
npm install tailwindcss postcss autoprefixer
# Worker (later):
npm install -g wrangler
```

## How to work with Abhi

Carries from `~/Core/Workspace/ClaudeCode/CLAUDE.md`:
- Be concise and direct. Lead with the answer.
- Non-engineer; knows GCP and partnerships, intermediate React/TS. Frame technical decisions for someone who can read code but doesn't write it daily.
- Default to sub-agents for research, multi-file reads, transcript analysis.
- Never commit social/launch/marketing drafts.
- Visual outputs: iterate at least twice against skill rules before showing.

## Strategic context

PromptDuel is the cheapest, fastest project in the tracker. Strategic role: **launch momentum**. Ship a viral asset in 1-2 weekends between weekends working on N (OpenMemoryStandard), O (OpenAgentBench), or R (WorldLab.web). Cross-pollinates downstream:
- Becomes the "debate quality" track inside Project O (OpenAgentBench)
- Becomes a "debate-this-decision-with-myself" skill inside Project K (OperatorSkills)
- Anti-target: don't expand v1 scope; preserve v2/v3 work for when v1 has proven the format

Public demos sit at `ondeviceml.space` (existing site, 24 lanes — PromptDuel is the 25th). Sister projects in the same Antigravity workspace: `voice-memory/`. Read those CLAUDE.md / STATUS.md for the patterns to mirror.
