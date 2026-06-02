# PromptDuel ⚔️

**Two small open-weight LLMs debate any topic you give them — live, side-by-side, fully in your browser. No cloud, no account, no cost.**

🔗 **[duel.ondeviceml.space](https://duel.ondeviceml.space)** · also at [promptduel.pages.dev](https://promptduel.pages.dev)

---

You type a topic — *"Will AGI arrive in 2027?"*, *"Should AI write my LinkedIn posts?"* — and two models argue opposite sides over three rounds (opening → rebuttal → closing), streaming token-by-token next to each other. You vote who won. Every duel has a shareable permalink.

The catch: **the models run entirely on your device** via WebGPU. Open your browser's network tab during a duel and you'll see zero outbound traffic. Your GPU is doing the thinking.

- 🎭 **The Optimist** (Gemma 3 1B) vs **The Skeptic** (Qwen 2.5 1.5B)
- 🧠 100% on-device inference — no API calls, no keys, no server doing the work
- 🆓 No account, no cost, no tracking
- 📱 Runs on desktop and phones (mobile uses a single model for both sides to fit memory)
- 🔗 Shareable permalink for every duel

> ⚠️ **For fun, not facts.** These are tiny models. They are confidently wrong on a regular basis. PromptDuel is entertainment — two pocket-sized AIs throwing hands — not a benchmark or a source of truth.

---

## How it works

```
            ┌─────────────────────────┐
            │     your browser tab     │
            └───────────┬─────────────┘
            ┌───────────┴───────────┐
   ┌────────▼────────┐     ┌────────▼────────┐
   │ Web Worker A    │     │ Web Worker B    │
   │ WebGPU context  │     │ WebGPU context  │
   │ Gemma 3 1B (YES)│     │ Qwen 2.5 1.5B(NO)│
   └─────────────────┘     └─────────────────┘
            └───────────┬───────────┘
              no cloud · no API · no account
```

Each model lives in its own Web Worker, so the two WebGPU contexts stream **in parallel** and the UI thread stays responsive. Models load once (cached after), then everything runs locally through [Transformers.js](https://github.com/huggingface/transformers.js).

## What made it hard (the interesting part)

A few lessons from getting two 1B-class models to behave:

1. **Small models won't pick a side.** Feed a small model its opponent's argument in the rebuttal round and it reads it, agrees, and *flips*. The fix: stop showing each model its opponent, and **prefill a committed opener** — the reply literally starts `"YES, because…"` and the model just continues it. You can't switch sides three words into your own sentence.

2. **"Be specific" summons hallucinations.** Telling a 1B model to "use a number / a real example" makes it *invent* fake studies, companies, and dates from a parallel universe (*"AGI arrives 27 Dec 22048"*). Now the prompt bans invented stats, and a client-side cleanup strips any absurd years/durations that slip through.

3. **The memory wall is real.** Two models ≈ 1.7GB. Great on a 16GB laptop, fatal (`std::bad_alloc`) on a 4GB Chromebook. So the app detects low-memory devices up front and runs **one** model playing both personas, with a reactive fallback if a second model fails to allocate mid-load.

4. **A second AI caught real bugs.** An independent [Codex](https://github.com/openai/codex) review flagged a duel that hung forever on a generation error and a stale-token leak when starting a new duel mid-stream. Both fixed.

There's a longer write-up in the launch blog (linked from the live site).

## Tech stack

- **Vite + React + TypeScript**
- **[Transformers.js](https://github.com/huggingface/transformers.js)** for in-browser inference (WebGPU, with a WASM/CPU fallback)
- **Tailwind CSS v4**
- **Cloudflare Pages** (frontend) + **Cloudflare Workers + KV** (permalinks, votes, moderation) — free tier, zero ongoing cost

## Run it locally

```bash
cd app
npm install
npm run dev
```

Open the printed URL in Chrome/Edge (or Safari 18+). First load downloads the models (~1.7GB on desktop, ~750MB single-model on mobile), then they're cached.

```bash
npm run build      # production build → app/dist
```

## Models

| Persona | Model | Vendor | Side |
|---------|-------|--------|------|
| The Optimist | [Gemma 3 1B IT](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX) | Google | YES |
| The Skeptic | [Qwen 2.5 1.5B Instruct](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct) | Alibaba | NO |

Both are open-weight models, loaded as int4 ONNX builds for the browser.

## Roadmap

v1 (shipped): two-model debate, 3 rounds, voting, permalinks, on-device. Possible v2 ideas if it catches on — tournament mode, a third model as a judge, personality presets, audio narration. One at a time.

---

Built in the open as a small experiment in on-device AI. Feedback and PRs welcome.
