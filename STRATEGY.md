# STRATEGY.md — Dual-Agent Workflow (Claude + Antigravity)

The strategy for working on PromptDuel from BOTH Claude Code and Antigravity simultaneously with minimal conflict.

## Why dual-agent?

PromptDuel has two natural halves that play to each agent's strengths:

| Half | Best agent | Why |
|---|---|---|
| **Frontend** — React UI, WebGPU model loading, iterative streaming UX | **Claude Code** | Tight feedback loop with browser dev tools; iterative UI work; you steer prompt-by-prompt |
| **Backend + Deploy + Automation** — Cloudflare Worker, KV, CI/CD, cron, deployment | **Antigravity** | Sub-agent orchestration, cron scheduling, longer autonomous runs; less interactive steering needed |

Running both in parallel = ~50% wall-clock reduction on the 1-2 weekend v1 timeline.

## The worktree setup

```
~/Core/Workspace/AntigravityCLI/
├── .antigravitycli/                 # parent Antigravity project registration
├── promptduel/                      # ← Claude Code worktree (branch: main)
│   ├── .git/                        # the actual git directory (shared)
│   ├── CLAUDE.md                    # Claude reads this
│   ├── AGENTS.md                    # Antigravity reads this (mirror)
│   ├── STRATEGY.md                  # this file — both read
│   ├── STATUS.md
│   ├── docs/spec.md
│   ├── app/                         # frontend lives here
│   └── worker/                      # backend lives here
└── promptduel-antigravity/          # ← Antigravity worktree (branch: antigravity-work)
    └── (same tree, different branch checkout)
```

Both worktrees share the same `.git` (in `promptduel/`). They check out different branches simultaneously. No clone, no remote needed (for now).

## File-ownership table (the single most important section)

**RULE: if it's in your column, you own it. If it's in the other's column, DO NOT EDIT.**
**RULE: if it's in the shared column, commit immediately after touching it and pull before next session.**

| Path | Claude Code | Antigravity | Shared |
|---|---|---|---|
| `app/src/components/**` | ✅ | ❌ | |
| `app/src/lib/models.ts` | ✅ | ❌ | |
| `app/src/lib/duel.ts` | ✅ | ❌ | |
| `app/src/lib/prompts.ts` | ✅ | ❌ | |
| `app/src/pages/**` | ✅ | ❌ | |
| `app/src/App.tsx` | ✅ | ❌ | |
| `app/src/main.tsx`, `app/src/index.css` | ✅ | ❌ | |
| `app/public/**` | | | ⚠️ shared |
| `app/src/lib/storage.ts` | | | ⚠️ shared — interfaces with worker |
| `worker/**` | ❌ | ✅ | |
| `wrangler.toml` | ❌ | ✅ | |
| `.github/workflows/**` | ❌ | ✅ | |
| `package.json` (app) | ✅ | ❌ | |
| `package.json` (worker) | ❌ | ✅ | |
| `tsconfig.json` (app) | ✅ | ❌ | |
| `vite.config.ts` | ✅ | ❌ | |
| `tailwind.config.js` | ✅ | ❌ | |
| `CLAUDE.md` | ✅ | ❌ | |
| `AGENTS.md` | ❌ | ✅ | |
| `STATUS.md` | | | ⚠️ shared — update at end of each session |
| `STRATEGY.md` (this file) | | | ⚠️ shared — change requires both agents pause |
| `docs/spec.md` | | | ⚠️ shared — spec changes need both agents to sync |
| `docs/demo-video-script.md` | ✅ | ❌ | |
| `docs/deployment-runbook.md` | ❌ | ✅ | |
| `.gitignore` | | | ⚠️ shared, but rarely changes |

For shared files: **commit + push + tell the other agent before they start.**

## Daily workflow

### Starting a Claude Code session

```bash
cd ~/Core/Workspace/AntigravityCLI/promptduel
git pull --rebase origin main 2>/dev/null || true   # if remote exists
git merge antigravity-work --no-commit --no-ff -X ours   # absorb backend changes
git commit -m "sync: merge antigravity-work" 2>/dev/null || true
claude
```

### Starting an Antigravity session

```bash
cd ~/Core/Workspace/AntigravityCLI/promptduel-antigravity
git fetch
git merge main --no-commit --no-ff -X ours              # absorb frontend changes
git commit -m "sync: merge main" 2>/dev/null || true
antigravity
```

### Ending any session

```bash
# 1. Make sure your changes are committed
git status
git add <files-you-changed>
git commit -m "<descriptive message>"

# 2. (Optional) push if you have a remote set up
git push origin <current-branch>

# 3. Update STATUS.md with what shipped this session and what's next
```

## Sync commands (when to merge)

| When | What to do |
|---|---|
| End of every session | Commit your branch's work |
| Start of every session | Merge the OTHER branch into yours (absorb their work) |
| End of Phase 1 (frontend ships) | Merge antigravity-work → main fully |
| End of Phase 2 (backend ships) | Merge antigravity-work → main fully |
| Before launch (Phase 3) | Full merge to main; both branches now equal; tag v1.0.0 |
| Any time STRATEGY.md or STATUS.md changes | Sync within 1 hour — these are the rails |

## Conflict-avoidance rules

1. **Stay in your lane.** The file-ownership table is the contract. If you need to touch the other agent's file, STOP. Open `STRATEGY.md` and document why the file should change ownership or become shared. Then resume.
2. **Commit before stepping away.** If you're going to leave a session paused for >30 min, commit. The other agent can't see your uncommitted work.
3. **No simultaneous edits on shared files.** If you need to edit `STATUS.md`, `STRATEGY.md`, or `docs/spec.md`, declare it (in chat to the user, who tells the other agent). Edit, commit, push immediately. Then unlock.
4. **One agent owns each shared file at a time.** If Claude is updating `docs/spec.md`, Antigravity must wait. This is enforced socially, not technically.
5. **Use small commits.** Smaller commits = easier merges. Don't batch 10 changes into one commit.
6. **Pull before push.** If a remote exists, always `git pull --rebase` before `git push` to surface conflicts early.
7. **End-of-day full merge.** At end of every working day, the user (Abhi) does a full merge of both branches into `main`, resolves any conflicts manually, and pushes. This becomes the canonical state.

## Branch hygiene

- `main` — the canonical state. Claude Code worktree lives here. Always shippable.
- `antigravity-work` — Antigravity's working branch. May be WIP / experimental.
- Long-running experimental work that might fail → make a third branch (e.g., `experiment/audio-narration`) and revert if it doesn't pan out. Don't pollute `main` or `antigravity-work`.

## Sync via a remote (optional, recommended once stable)

Currently the worktrees sync locally (no GitHub needed). Once v1 is closer:

```bash
# Create a private GitHub repo first (https://github.com/new), then:
cd ~/Core/Workspace/AntigravityCLI/promptduel
git remote add origin https://github.com/abhid1234/promptduel.git
git push -u origin main
git push -u origin antigravity-work
```

After that, both worktrees can `git pull --rebase` to sync via the remote. Useful when:
- Working on the project from your phone via Claude Code Remote Control
- Working from a different machine
- Wanting GitHub Actions for CI/CD (which Antigravity should set up in `.github/workflows/`)

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Already up to date" but you see different files in two worktrees | Make sure you're in the right directory; each worktree has its own checkout |
| Merge conflict on a file you "own" | Check the ownership table — the other agent probably edited it. Resolve, document, fix the ownership rule if needed |
| Lock file (package-lock.json) conflicts | Delete it, re-run `npm install` in the affected worktree, commit |
| Worker changes don't show in frontend dev | Restart `wrangler dev` in the Antigravity worktree; frontend `vite dev` doesn't auto-reload worker changes |
| You forgot which branch you're on | `git branch --show-current` |

## The escape valve

If this dual-agent setup becomes more overhead than savings, KILL IT and go single-agent for the rest of v1:

```bash
cd ~/Core/Workspace/AntigravityCLI/promptduel
git merge antigravity-work --no-ff -m "merge: kill dual-agent setup, going single"
git worktree remove ../promptduel-antigravity
git branch -d antigravity-work
```

The whole strategy is reversible in 30 seconds. Don't let the workflow become the bottleneck.

## Why this works for PromptDuel specifically

PromptDuel has a CLEAN frontend/backend separation:
- Frontend = the entire visitor experience (WebGPU model loading, streaming UI, voting). Iterative UI work. Claude's strength.
- Backend = Cloudflare Worker stores permalinks + votes. Static infrastructure once shipped. Antigravity's strength (one-time setup + cron + deploy automation).

The shared surface (`storage.ts`, `STATUS.md`, `docs/spec.md`) is TINY. That's why dual-agent is low-risk here.

For projects with more cross-cutting concerns (e.g., Project N OpenMemoryStandard where schema changes touch everything), dual-agent may not be worth it.
