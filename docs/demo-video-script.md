# PromptDuel — Demo Video Script & Production Guide

**Format:** 60-90s product demo · 16:9 landscape · screen recording with auto-zoom
· on-screen captions · music bed · **no voiceover.**
**Goal:** make a stranger get it in 5 seconds and want to try it. Lead with the
spectacle (two AIs arguing live), prove the "on-device, no cloud" claim, end on
the URL.

---

## 0. Pre-flight (do this before you hit record)

1. **Record on desktop Chrome** (Chromebook or laptop), not the phone — the
   dual-model *concurrent* side-by-side streaming is the hero shot and only runs
   that way on desktop. (Mobile = single-model fallback, less impressive.)
2. **Pre-load the models once** so they're cached. The first-ever load downloads
   ~450MB — you don't want that on camera. Run one full duel first, then the
   recording run loads from cache in a couple seconds. (Or record the load and
   speed-ramp it 4-8× in editing.)
3. **Clean browser:** new/guest Chrome profile, hide the bookmarks bar
   (Ctrl/Cmd+Shift+B), close other tabs, full-screen the window. No personal info
   on screen.
4. **Pick a spicy topic** that reliably produces a committed, entertaining
   disagreement. Recommended hero topic (on-brand for a LinkedIn launch):
   **"Should AI write my LinkedIn posts?"** Backup: "Is vibe coding real
   engineering?"
5. **Window size:** ~1280-1440px wide so the two columns and text are legible
   when zoomed. Record at 1080p minimum (1440p/4K if you can — lets you punch in
   without softness).

---

## 1. Toolchain (record → zoom → caption → music)

You need: a recorder that does the smooth auto-zoom, then captions + a music bed.

### Recommended (cross-platform, free): **Cap** (cap.so)
Free, open-source, does the Screen-Studio-style **automatic zoom-on-click** and
smooth cursor. Record the duel, export. Works on Mac + Windows.

### Best-in-class (Mac only, paid): **Screen Studio** (~$89)
The tool most of these "Demo Clip" videos are made with. Auto-zoom, cursor
smoothing, backgrounds, captions — one app does everything. If you're on a Mac
and will make more videos, it's worth it.

### Chromebook / Linux path (free):
- **Record:** Screenity (free Chrome extension) or the built-in Chromebook screen
  recorder. These don't auto-zoom, so —
- **Edit + zoom + caption:** **CapCut** (free, web + desktop) — add zoom
  keyframes manually on click moments, auto-generate captions, drop in music.
  (DaVinci Resolve free is the heavier-duty alternative.)

### Captions
Cap/Screen Studio do them inline. Otherwise CapCut auto-captions, or just add the
caption text below as **manual text overlays** (cleaner, you control wording).

### Music (royalty-free, no copyright strikes)
YouTube Audio Library · Pixabay Music · Uppbeat · Epidemic Sash (paid). Pick
**upbeat, modern, instrumental, ~90-110 BPM, no vocals.** Swell at the open and
the CTA, keep it ~20-25% volume under the action.

---

## 2. Shot-by-shot script (target ~75s)

> Captions = big, bold, lower-third or centered, 2-5 words, on screen 2-3s each.
> "Zoom" = punch in on that element. Cuts are clean (no fancy transitions).

| # | Time | On screen (action) | Caption (on-screen text) | Note |
|---|------|--------------------|--------------------------|------|
| 1 | 0:00-0:03 | Cold open **mid-duel**: both columns already streaming text fast, side by side | **"Two AIs. Arguing. Live."** | Hook first — spectacle before explanation. Music swells. |
| 2 | 0:03-0:08 | Cut to the Home screen; cursor types the topic into the box | **"Pick any topic."** | Type it live; let them read it. |
| 3 | 0:08-0:12 | Click **⚔️ Start Duel**; the two columns appear (Gemma=YES blue, Qwen=NO red) | **"Two open-weight models. Opposite sides."** | Zoom out to show both columns + the YES/NO badges. |
| 4 | 0:12-0:30 | Both columns **stream concurrently**; let it run. Zoom gently between columns | **"Gemma argues YES · Qwen argues NO"** then **"3 rounds: opening → rebuttal → closing"** | The core. Don't rush — the live dual-stream IS the wow. Show the RoundIndicator ticking 1/3 → 2/3. |
| 5 | 0:30-0:40 | Keep streaming into round 2/3; punch in on a sharp line where one model attacks the other | **"They actually rebut each other."** | Pick a moment where a model references the opponent's point. |
| 6 | 0:40-0:50 | Open Chrome **DevTools → Network** tab; show **no outbound requests** during generation | **"100% on-device. Zero cloud calls."** then **"No account. No API. Just your browser."** | The credibility beat — this is the whole differentiator. The empty network tab during inference is proof. |
| 7 | 0:50-0:58 | Duel ends; click a **Vote** button (👑 crowns the winner) | **"You vote who won."** | Quick, satisfying. |
| 8 | 0:58-1:05 | Click **🔗 Share this duel** → a permalink appears → click **Copy** | **"Every duel has a permalink."** | Show the URL populate. |
| 9 | 1:05-1:12 | Cut to a clean end card: PromptDuel wordmark on the dark gradient | **"PromptDuel"** + **"duel.ondeviceml.space"** | Music swells. Hold 3s. Make the URL big and legible. |

**Total: ~72s.** Trim sections 4-5 if it runs long; that's where the slack is.

### Caption copy bank (swap freely)
- "Two AIs. Arguing. Live."
- "Pick a fight. Any topic."
- "On-device. In your browser."
- "No cloud. No account. No cost."
- "Watch them rebut each other."
- "You're the judge."
- "Share the duel. It has a permalink."

---

## 3. The on-device proof shot (don't skip it)

Section 6 is the most important credibility moment and the answer to the
inevitable *"this is just calling an API"* comment. Before recording:
- Open DevTools (F12) → **Network** tab → clear it.
- Start a duel. During generation, the Network tab stays **empty** (models are
  already cached; inference is local). That visible emptiness is the proof.
- If model files show from an earlier load, do a duel first to cache, then clear
  Network and start a fresh duel for the shot.

---

## 4. Export & post

- **Export:** 1080p (or 1440p) H.264 MP4, 30fps, ~8-12 Mbps. Keep it under ~20MB
  if possible for easy social upload.
- **Landscape 16:9** is the master. For the launch posts you'll also want a
  **9:16 vertical cut** (sections 1, 4, 6, 9) at ~20s for Reels/Shorts/X.
- **First frame matters** (it's the thumbnail/autoplay poster): make it the
  mid-duel dual-stream, not a blank screen.
- **Captions burned in** — 85% of social video is watched on mute.

## 5. Don't
- Don't show the ~450MB first load on camera (pre-cache or speed-ramp it).
- Don't record on the phone (single-model fallback — less impressive).
- Don't reference employer / Google Cloud / 20% in the video or its caption
  (per `feedback_no_employer_in_launch_materials.md`).
- Don't put the launch post copy in this repo — script lives here, post drafts do
  not (per `feedback_social_posts_never_in_git.md`).

---

*Note: until `duel.ondeviceml.space` is mapped, record/point the end card at the
working URL `promptduel.pages.dev`. Swap to the custom domain once it's live.*
