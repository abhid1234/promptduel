# AGENTS.md — promptduel (Antigravity context)

This is the Antigravity-facing context file. It mirrors `CLAUDE.md` so both agents have the same baseline understanding, with Antigravity-specific instructions on top.

## Antigravity-specific: your lane

Per `STRATEGY.md`, your lane in this project is **backend + deployment + automation**:
- `worker/**` — Cloudflare Worker for permalinks + votes + analytics
- `wrangler.toml` — Cloudflare deployment config
- `.github/workflows/**` — CI/CD automation
- `docs/deployment-runbook.md` — operational docs
- `package.json` (worker) — worker dependencies

**DO NOT edit** frontend files (anything under `app/src/components/`, `app/src/pages/`, `app/src/lib/models.ts`, etc.). Those are Claude Code's lane.

**SHARED files** (require careful coordination, see STRATEGY.md):
- `STATUS.md` — update at end of session
- `STRATEGY.md` — change requires both agents pause
- `docs/spec.md` — spec changes need sync
- `app/src/lib/storage.ts` — frontend ↔ backend interface

Read `STRATEGY.md` BEFORE starting any work. Always.

## Your starting tasks (Phase 2)

When Claude finishes Phase 1 (frontend loads two models and streams), your Phase 2 is:

1. **Scaffold the Cloudflare Worker** at `worker/`:
   ```
   worker/
   ├── src/index.ts          # POST /api/save-duel, GET /api/duel/:id, POST /api/vote
   ├── wrangler.toml         # KV namespace binding, route config
   └── package.json
   ```

2. **Implement endpoints:**
   - `POST /api/save-duel` — body: `{ topic, models, transcript, seeds }` → returns `{ id }`
   - `GET /api/duel/:id` — returns the saved duel data so frontend can re-run
   - `POST /api/vote` — body: `{ duel_id, winner }` → increments vote count in KV

3. **Define the storage interface** the frontend will call (`app/src/lib/storage.ts` — shared file, edit with Claude's awareness):
   ```typescript
   export async function saveDuel(duel: DuelTranscript): Promise<{ id: string }>
   export async function loadDuel(id: string): Promise<DuelTranscript>
   export async function recordVote(id: string, winner: 'A' | 'B'): Promise<void>
   ```

4. **Set up GitHub Actions CI/CD** at `.github/workflows/deploy.yml` — auto-deploy worker on push to main.

5. **Write `docs/deployment-runbook.md`** — how Abhi (or future Claude) deploys, where the secrets live, how to roll back.

## Antigravity capabilities to leverage

This is where you shine relative to Claude Code:

- **Sub-agents** — dispatch parallel sub-agents for: "set up CF Worker", "set up KV namespace", "write deploy script", "write CI workflow". All in parallel.
- **Cron** — set up a weekly cron sub-agent that picks the duel-of-the-day for v3. (Add to STATUS.md as v3 work.)
- **Long autonomous runs** — backend + deploy work is less interactive than UI; you can run multi-hour autonomous build sessions while Abhi steers Claude Code on the frontend.

## Coordination with Claude Code

- Claude updates `STATUS.md` at end of every session — read it at start of yours
- If you need to change a SHARED file, post in chat to Abhi who will tell Claude to pause
- Before merging your branch (`antigravity-work` → `main`), make sure all your worker tests pass and `wrangler deploy` succeeds in dry-run mode

---

# Everything below mirrors CLAUDE.md

## What this is

**PromptDuel** — a cheap, fast, viral on-device demo where two small open-weight LLMs run in parallel WebGPU contexts inside a browser, debate a user-supplied topic with adversarial system prompts, stream responses side-by-side over 3 rounds, and the user votes who won. Every duel has a permalink. Lives at `duel.ondeviceml.space`. ZERO compute cost, ZERO ongoing cost. Fastest shippable cool project in the entire tracker.

Project CC in Abhi's `RL & Agentic AI Project Pipeline` tracker. The "ship between bigger projects for low-risk launch momentum" pick.

**Spec:** see `docs/spec.md`.
**Status:** see `STATUS.md`.
**Workflow:** see `STRATEGY.md`.

## v1 scope (locked)

- Two models: Gemma 4 270M IT + Qwen 2.5 0.5B. ~450MB total.
- 3 rounds: opening → rebuttal → closing.
- Side-by-side streaming.
- Vote button + share permalink.
- Mobile-responsive on `duel.ondeviceml.space`.
- Cloudflare Workers + KV for permalink + vote analytics.
- 1-2 weekends to ship v1.

## Hard constraints — DO NOT VIOLATE

1. On-device inference only. No cloud LLM calls in the hot path.
2. Open-weight models only (Apache 2.0 or MIT).
3. No new infrastructure costs. Static hosting + Cloudflare Workers free tier ONLY.
4. Per `feedback_odml_mediapipe_constraints.md` — blob URL pattern when loading model files.
5. Per `feedback_social_posts_never_in_git.md` — no LinkedIn or Substack drafts in this repo.
6. Per `feedback_no_employer_in_launch_materials.md` — no Google Cloud / employer / 20% / colleague refs in public artifacts.
7. Adversarial-by-design — system prompts must force position commitment.
8. Don't divert from N/O/P/K/L/M — this is launch-momentum fuel, not the main course.

## How to work with Abhi

- Be concise and direct. Lead with the answer.
- Non-engineer; intermediate React/TS. Frame technical decisions for someone who can read code but doesn't write it daily.
- Default to sub-agents for parallel work.
- Never commit social/launch/marketing drafts.
