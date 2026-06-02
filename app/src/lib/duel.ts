// Duel orchestration: runs the full 3-round debate (opening → rebuttal →
// closing). Each round fans the topic out to both models concurrently; before
// rounds 2 and 3 each model is fed its opponent's previous-round argument so it
// can rebut. Emits a transcript shaped for the shared storage client so Phase 2
// can persist + permalink it.

import { MODELS, MODEL_ORDER, type ModelId } from "./models";
import { buildMessages, stancePrefill, type Round } from "./prompts";
import type { DuelTranscript } from "./storage";
import type { ProgressInfo } from "@huggingface/transformers";

export type LoadState = "idle" | "loading" | "ready" | "error";
export type Device = "webgpu" | "wasm";

export interface ModelProgress {
  state: LoadState;
  /** 0-100, best-effort across the model's files. */
  percent: number;
  label: string;
}

interface WorkerOutMsg {
  type: "load-progress" | "ready" | "token" | "done" | "error";
  info?: ProgressInfo;
  text?: string;
  message?: string;
  phase?: string;
  /** Generation epoch this message belongs to (stale ones are ignored). */
  epoch?: number;
}

export interface DuelCallbacks {
  onProgress: (id: ModelId, p: ModelProgress) => void;
  /** Fired once the real compute backend is known (after adapter probe). */
  onDevice: (device: Device) => void;
  /** A streamed token for the given model's current round. */
  onToken: (id: ModelId, round: Round, text: string) => void;
  /** Both models finished the given round. */
  onRoundComplete: (round: Round) => void;
  /** All 3 rounds done; transcript is ready to vote on / persist. */
  onDuelComplete: (transcript: DuelTranscript) => void;
  onError: (id: ModelId, message: string) => void;
  /** Reports the run mode + which model hosts both sides in single-model mode. */
  onMode?: (concurrent: boolean, hostId: ModelId) => void;
}

/**
 * Mobile GPUs can load both models but OOM when *both* run inference at once
 * (two WebGPU contexts allocating KV-cache + activations simultaneously crashes
 * the renderer). On mobile we generate one model per round at a time — both
 * columns still fill, just sequentially. Desktop keeps true concurrent streaming.
 */
function isMobile(): boolean {
  const uaData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Use a single model (one context, ~half the memory) when the device can't fit
 * both: any mobile, OR ≤4GB RAM (1B+1.5B need ~2.5GB resident). Deciding this
 * UP FRONT avoids downloading ~1.7GB and then discarding Qwen on a std::bad_alloc
 * — and avoids the jarring "Qwen → The Skeptic" relabel mid-load. Bigger devices
 * still attempt both and fall back reactively if they OOM. (navigator.deviceMemory
 * caps at 8 in Chrome, so a value of 4 reliably means a genuinely small device.)
 */
function prefersSequential(): boolean {
  if (isMobile()) return true;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof mem === "number" && mem <= 4;
}

const ROUNDS: Round[] = [1, 2, 3];

function opponentOf(id: ModelId): ModelId {
  return MODEL_ORDER.find((other) => other !== id) ?? id;
}

/**
 * Probe for a *working* WebGPU adapter — not just `navigator.gpu` existing.
 * Plenty of browsers expose `navigator.gpu` but `requestAdapter()` returns
 * null (no/blocked GPU, headless Chrome without the flag, some iOS builds).
 * Falling back to WASM keeps the duel running instead of erroring out.
 */
async function detectDevice(): Promise<Device> {
  // Manual overrides for debugging mobile crashes: ?cpu=1 forces WASM (cannot
  // crash the GPU driver), ?gpu=1 forces a WebGPU attempt.
  const params = new URLSearchParams(window.location.search);
  if (params.get("cpu") === "1") return "wasm";
  const forceGpu = params.get("gpu") === "1";
  try {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return "wasm";
    if (forceGpu) return "webgpu";
    const adapter = await gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

/**
 * The single model used for both sides on constrained devices. Gemma 3 1B is
 * the lighter of the pair, so it's the default host when we can only fit one.
 */
const DEFAULT_HOST: ModelId = "gemma";

export class DuelEngine {
  private workers: Record<ModelId, Worker>;
  private cb: DuelCallbacks;
  private readyCount = 0;

  // Per-duel state.
  private topic = "";
  private activeRound: Round = 1;
  private texts: Record<Round, Partial<Record<ModelId, string>>> = {
    1: {},
    2: {},
    3: {},
  };
  private doneThisRound = new Set<ModelId>();
  private seeds: Record<ModelId, number> = { gemma: 0, qwen: 0 };
  /** false on mobile → generate one model at a time to avoid GPU OOM. */
  private concurrent = !prefersSequential();
  /**
   * Run a SINGLE model for both sides — one context instead of two. Forced on
   * mobile (two GPU contexts crash phones) and auto-engaged on desktop if the
   * second model can't allocate memory (std::bad_alloc). The other column is
   * served by the host model.
   */
  private singleModel = prefersSequential();
  /** Which model hosts both sides in single-model mode. */
  private hostId: ModelId = DEFAULT_HOST;
  /** Guard so a second load failure doesn't re-trigger the fallback. */
  private fellBack = false;
  /** Sequential mode: models still waiting to generate in the current round. */
  private pending: ModelId[] = [];
  /** Single-model mode: which column the host model is currently generating. */
  private currentTarget: ModelId = MODEL_ORDER[0];
  /** Bumped each duel; worker output tagged with a stale epoch is discarded so a
   *  previous duel's in-flight tokens can't leak into a new duel or the home view. */
  private epoch = 0;

  constructor(cb: DuelCallbacks) {
    this.cb = cb;
    this.workers = {} as Record<ModelId, Worker>;

    for (const id of MODEL_ORDER) {
      const worker = new Worker(new URL("./duel.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener("message", (e: MessageEvent<WorkerOutMsg>) =>
        this.onMessage(id, e.data),
      );
      this.workers[id] = worker;
    }
  }

  get bothReady(): boolean {
    return this.readyCount >= MODEL_ORDER.length;
  }

  /** Probe the GPU, report the chosen backend, then kick off both downloads. */
  async load() {
    const device = await detectDevice();
    this.cb.onDevice(device);
    this.cb.onMode?.(this.concurrent, this.hostId);

    // Which models actually load: just the host on mobile, both on desktop.
    const toLoad = this.singleModel ? [this.hostId] : MODEL_ORDER;

    // Columns not backed by a real load (the Qwen column in single-model mode)
    // are immediately "ready" — they're served by the host model.
    for (const id of MODEL_ORDER) {
      if (!toLoad.includes(id)) {
        this.cb.onProgress(id, {
          state: "ready",
          percent: 100,
          label: "Ready",
        });
      }
    }

    for (const id of toLoad) {
      const m = MODELS[id];
      this.cb.onProgress(id, {
        state: "loading",
        percent: 0,
        label: "Starting…",
      });
      this.workers[id].postMessage({
        type: "load",
        repo: m.repo,
        dtype: m.dtype,
        device,
      });
    }
  }

  /** Stop the current duel: invalidate in-flight worker output and interrupt
   *  generation so a previous duel can't leak tokens into the next one. */
  stop() {
    this.epoch += 1;
    for (const id of MODEL_ORDER) {
      this.workers[id].postMessage({ type: "stop" });
    }
  }

  /** Begin a fresh 3-round duel on `topic`. */
  startDuel(topic: string) {
    this.stop(); // cancel anything still running from a previous duel
    this.topic = topic;
    this.texts = { 1: {}, 2: {}, 3: {} };
    this.pending = [];
    // Seeds are recorded for Phase 2 permalink reproduction. Small-model
    // determinism is finicky, so v1 treats the permalink as "same topic +
    // sides", not bit-exact replay (see STATUS.md open issues).
    this.seeds = {
      gemma: Math.floor(Math.random() * 2 ** 31),
      qwen: Math.floor(Math.random() * 2 ** 31),
    };
    this.runRound(1);
  }

  private runRound(round: Round) {
    this.activeRound = round;
    this.doneThisRound.clear();
    if (this.concurrent) {
      for (const id of MODEL_ORDER) this.generateFor(id, round);
    } else {
      // One model at a time: fire the first, queue the rest; the done handler
      // starts the next when each finishes.
      this.pending = MODEL_ORDER.slice(1);
      this.generateFor(MODEL_ORDER[0], round);
    }
  }

  private generateFor(id: ModelId, round: Round) {
    // In single-model mode the host worker does the work, but the argument's
    // position/opponent come from the *column* (id), and the host's chat
    // template (supportsSystemRole) is what actually runs.
    const hostId = this.singleModel ? this.hostId : id;
    const host = MODELS[hostId];
    const column = MODELS[id];
    // Feed the model its OWN previous round so it makes a fresh point each time.
    const ownLast =
      round > 1 ? this.texts[(round - 1) as Round][id] : undefined;
    const messages = buildMessages({
      position: column.position,
      topic: this.topic,
      round,
      ownLast,
      supportsSystemRole: host.supportsSystemRole,
    });
    this.currentTarget = id;
    this.workers[hostId].postMessage({
      type: "generate",
      messages,
      prefill: stancePrefill(column.position),
      epoch: this.epoch,
    });
  }

  private onMessage(id: ModelId, msg: WorkerOutMsg) {
    switch (msg.type) {
      case "load-progress": {
        const p = msg.info;
        if (p && p.status === "progress" && "progress" in p) {
          this.cb.onProgress(id, {
            state: "loading",
            percent: Math.round(p.progress ?? 0),
            label: `Downloading ${shortenFile((p as { file?: string }).file)}`,
          });
        }
        break;
      }
      case "ready": {
        this.readyCount += 1;
        this.cb.onProgress(id, {
          state: "ready",
          percent: 100,
          label: "Ready",
        });
        break;
      }
      case "token": {
        if (this.isStale(msg)) break;
        const col = this.singleModel ? this.currentTarget : id;
        this.cb.onToken(col, this.activeRound, msg.text ?? "");
        break;
      }
      case "done": {
        if (this.isStale(msg)) break;
        const col = this.singleModel ? this.currentTarget : id;
        this.completeColumn(col, this.activeRound, msg.text ?? "");
        break;
      }
      case "error": {
        // A model ran out of memory loading the second context (std::bad_alloc).
        // Instead of a dead column, fall back to single-model mode: the model
        // that did load plays both sides.
        if (msg.phase === "load" && !this.singleModel && !this.fellBack) {
          this.fellBack = true;
          this.singleModel = true;
          this.concurrent = false;
          this.hostId = opponentOf(id); // the model that didn't fail
          this.cb.onMode?.(false, this.hostId);
          // The failed column is now served by the host — clear its error.
          this.cb.onProgress(id, {
            state: "ready",
            percent: 100,
            label: "Ready",
          });
          break;
        }
        // Generate-phase error (e.g. WebGPU device lost mid-inference): don't
        // hang the duel — record what streamed (or a marker) for this round and
        // advance, so vote/share still unlock.
        if (msg.phase === "generate") {
          if (this.isStale(msg)) break;
          const col = this.singleModel ? this.currentTarget : id;
          const partial = this.texts[this.activeRound][col];
          const text =
            partial && partial.trim()
              ? partial
              : "⚠ (this side errored out this round)";
          this.completeColumn(col, this.activeRound, text);
          break;
        }
        // Remaining load errors (fallback already spent, or both models failed).
        this.cb.onProgress(id, { state: "error", percent: 0, label: "Error" });
        this.cb.onError(id, msg.message ?? "Unknown error");
        break;
      }
    }
  }

  /** True if this generation message belongs to a superseded duel. */
  private isStale(msg: WorkerOutMsg): boolean {
    return msg.epoch !== undefined && msg.epoch !== this.epoch;
  }

  /** Record a column's result for the round, then advance: next sequential model,
   *  next round, or duel complete. Shared by normal completion and error recovery. */
  private completeColumn(col: ModelId, round: Round, text: string) {
    this.texts[round][col] = text;
    this.doneThisRound.add(col);
    if (!this.concurrent && this.pending.length > 0) {
      const next = this.pending.shift()!;
      this.generateFor(next, round);
      return;
    }
    if (this.doneThisRound.size >= MODEL_ORDER.length) {
      this.cb.onRoundComplete(round);
      if (round < 3) {
        this.runRound((round + 1) as Round);
      } else {
        this.cb.onDuelComplete(this.buildTranscript());
      }
    }
  }

  /** Shape the duel into the storage client's DuelTranscript (A=gemma, B=qwen). */
  private buildTranscript(): DuelTranscript {
    return {
      topic: this.topic,
      models: { A: "gemma", B: "qwen" },
      transcript: ROUNDS.map((r) => ({
        round: r,
        A: this.texts[r].gemma ?? "",
        B: this.texts[r].qwen ?? "",
      })),
      seeds: { A: this.seeds.gemma, B: this.seeds.qwen },
    };
  }

  dispose() {
    for (const id of MODEL_ORDER) this.workers[id].terminate();
  }
}

function shortenFile(file?: string): string {
  if (!file) return "model";
  const base = file.split("/").pop() ?? file;
  return base.length > 24 ? base.slice(0, 21) + "…" : base;
}
