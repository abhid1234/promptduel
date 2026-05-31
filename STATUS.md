# promptduel — PromptDuel project status

Where the v1 ship is and what to do next. Update at the end of every working session.

## Last updated

2026-05-31 — Phase 0 complete (project decided + scaffolded + entered as Project CC in tracker doc + git initialized + dual-agent worktree set up). Phase 1 (dual-model load + streaming UI) is next milestone.

**Dual-agent worktree active.** Read `STRATEGY.md` before any work.
- Claude Code: `~/Core/Workspace/AntigravityCLI/promptduel/` (branch: `main`)
- Antigravity: `~/Core/Workspace/AntigravityCLI/promptduel-antigravity/` (branch: `antigravity-work`)
- File ownership: frontend = Claude, backend + deploy + automation = Antigravity. Full table in `STRATEGY.md`.

## Phase status

- ✅ **Phase 0: Design + scaffold** — Project CC entry in tracker doc; CLAUDE.md + STATUS.md + spec.md scaffolded at `~/Core/Workspace/AntigravityCLI/promptduel/`. v1 scope locked: Gemma 4 270M + Qwen 2.5 0.5B, 3 rounds, side-by-side streaming, vote + permalink, on `duel.ondeviceml.space`.
- 🧪 **Phase 1: Dual-model load + streaming UI — CODE COMPLETE, pending on-device WebGPU verification (Claude Code)** — Vite + Transformers.js dual Web Worker layout (Gemma 3 270M IT + Qwen 2.5 0.5B ONNX) with WASM fallback. Parallel WebGPU contexts stream concurrently. ~1 weekend.
- ✅ **Phase 2: Debate orchestration + voting + permalink** — Full 3-round debate logic (opening, rebuttal, closing), voting bar, community reporting, profanity filter, telemetry funnels, and KV storage backend fully completed, integrated, and verified. ~half weekend.
- ⏸️ **Phase 3: Mobile polish + launch** — Mobile responsive layout. Touch-friendly vote UI. Topic suggestion list (12 curated prompts). Deploy to `duel.ondeviceml.space` as the 25th lane on ondeviceml.space. Demo video. Launch on LinkedIn + X. ~half weekend.
- ⏸️ **Phase 4 (v2 — only if v1 catches): Tournament mode + Judge mode + Personality cards.** Each is +1 weekend independently. Ship as separate viral posts once v1 lands.
- ⏸️ **Phase 5 (v3 — opportunistic): Audio narration via Web Speech API + Live audience real-time voting.** Each +1 weekend.

## Resume here next session

**The exact next step: Phase 3 — Mobile polish, deploying the worker + frontend, and launching.**

1. Run on-device verification of WebGPU on a phone/Chromebook.
2. Polish any UI/spacing issues found (especially styling in Tailwind v4).
3. Set up the production Cloudflare KV namespace and update `wrangler.toml` in `worker/`.
4. Deploy the worker to production:
   ```bash
   cd worker
   npm run deploy
   ```
5. Deploy the static frontend app to `duel.ondeviceml.space` (configured to route `/api/*` to the worker).
6. Verify production health and run final canary checks.

## Decisions log (don't relitigate without reason)

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-31 | Gemma 4 270M + Qwen 2.5 0.5B selected as v1 models | ~450MB total, safe on phones AND personality difference is already visible at this size. Larger pair (e.g., 2× 1.5B) is borderline for mobile WebGPU. |
| 2026-05-31 | Transformers.js (HuggingFace) over MediaPipe tasks-genai | Better support for two concurrent model contexts; the cross-vendor model loading (Gemma + Qwen) is cleaner with Transformers.js than MediaPipe (Google-Gemma-centric). |
| 2026-05-31 | 3 rounds (opening → rebuttal → closing), not single-shot | Single-shot is too thin to feel like a real debate; 3 rounds is the sweet spot for entertainment without overstaying. Locked at 3 unless v2 user testing shows otherwise. |
| 2026-05-31 | Cloudflare Workers + KV for permalinks, not Supabase | CF free tier handles 100K req/day; KV is free at this scale. Supabase is overkill. |
| 2026-05-31 | Lives on duel.ondeviceml.space (subdomain of existing site) | Inherits existing distribution audience. Same deploy pipeline as the other 24 lanes. |
| 2026-05-31 | Adversarial-by-design (forced position commitment), NOT LMSys-style benchmark | Different intent: PromptDuel is entertainment, LMSys Chatbot Arena is benchmarking. Keep the positioning crisp in the launch post. |
| 2026-05-31 | 1-2 weekend cap for v1 | This is launch-momentum fuel between bigger projects. Don't let it grow into a 6-weekend epic. v2/v3 only AFTER v1 ships and validates. |

## Things I'd flag to a new session

- **Don't load models >500M each.** Two 1.5B-class models is 1.6-2GB combined — borderline on phone browsers, per Abhi's `feedback_machine_memory.md` (browsers cap at 8GB, models >1.5GB risky). Stick to 270M + 500M for v1. Upgrade only if v1 ships and validates.
- **Don't add cloud fallback.** The whole pitch is "in your browser, on-device." Cloud fallback would defeat the demo even if it'd help quality.
- **Don't grow v1 scope.** Tournament / Judge / Audio / Live-audience are v2/v3. Resist the temptation to ship them all in v1 — the project's value is its 1-2 weekend ship-ability.
- **Don't draft launch posts in this repo.** Per `feedback_social_posts_never_in_git.md`. Demo video script is OK (`docs/demo-video-script.md`).
- **Don't reference Google Cloud / 20% / employer / colleagues in public launch artifacts.** Per `feedback_no_employer_in_launch_materials.md`.
- **Don't use `self.import` for model loading.** Use blob URL pattern per `feedback_odml_mediapipe_constraints.md` — breaks streaming/WebGPU/Workers otherwise.
- **Force adversarial commitment.** Small models love to hedge ("I respect your perspective..."). The system prompt MUST force position. Test prompts heavily before launch. See `docs/spec.md` for the adversarial template that works.
- **Pre-empt the "this isn't real benchmarking" critique.** Someone in the X thread will compare to LMSys Chatbot Arena. The launch post should be CRISP: this is entertainment, not benchmarking. Different audience, different intent.

## Open issues / known unknowns

- **iOS Safari WebGPU + concurrent contexts.** WebGPU got much better in Safari 18 (mid-2025) but running TWO concurrent inference contexts is untested at scale. Verify in Phase 1; if it fails, ship as "best on Chrome/Edge mobile" with a graceful WebGL fallback that runs one model at a time.
- **Streaming UI flicker.** Two columns updating in parallel at ~10-30 tok/s each could feel jittery. Plan to batch token updates into 50ms windows for smooth visual streaming.
- **Permalink collision strategy.** Should `(topic_hash + seed + model_pair)` be the permalink key, or accept that re-running gives different output (small-model determinism is finicky even with same seed)? Lean toward "permalink = topic + side assignments; output may vary slightly" with a "deterministic mode" toggle for v2.
- **Topic moderation.** Small models can say things. Need a basic profanity filter on display + "report this duel" link. Worth ~1 hour of build time before launch.
- **Tracking duel completion rate.** What % of started duels reach the vote screen? Critical funnel metric. Use Cloudflare Workers Analytics for this (free).
