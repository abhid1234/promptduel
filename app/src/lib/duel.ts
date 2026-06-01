// Duel orchestration: runs the full 3-round debate (opening → rebuttal →
// closing). Each round fans the topic out to both models concurrently; before
// rounds 2 and 3 each model is fed its opponent's previous-round argument so it
// can rebut. Emits a transcript shaped for the shared storage client so Phase 2
// can persist + permalink it.

import { MODELS, MODEL_ORDER, type ModelId } from "./models";
import { buildMessages, type Round } from "./prompts";
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
  /** Reports whether both models stream at once (desktop) or one-at-a-time (mobile). */
  onMode?: (concurrent: boolean) => void;
}

/**
 * Mobile GPUs can load both models but OOM when *both* run inference at once
 * (two WebGPU contexts allocating KV-cache + activations simultaneously crashes
 * the renderer). On mobile we generate one model per round at a time — both
 * columns still fill, just sequentially. Desktop keeps true concurrent streaming.
 */
function prefersSequential(): boolean {
  const uaData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
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
  try {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return "wasm";
    const adapter = await gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

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
  /** Sequential mode: models still waiting to generate in the current round. */
  private pending: ModelId[] = [];

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
    this.cb.onMode?.(this.concurrent);
    for (const id of MODEL_ORDER) {
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

  /** Begin a fresh 3-round duel on `topic`. */
  startDuel(topic: string) {
    this.topic = topic;
    this.texts = { 1: {}, 2: {}, 3: {} };
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
    const m = MODELS[id];
    const opponentLast =
      round > 1 ? this.texts[(round - 1) as Round][opponentOf(id)] : undefined;
    const messages = buildMessages({
      position: m.position,
      topic: this.topic,
      round,
      opponentLast,
      supportsSystemRole: m.supportsSystemRole,
    });
    this.workers[id].postMessage({ type: "generate", messages });
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
      case "token":
        this.cb.onToken(id, this.activeRound, msg.text ?? "");
        break;
      case "done": {
        const round = this.activeRound;
        this.texts[round][id] = msg.text ?? "";
        this.doneThisRound.add(id);
        // Sequential mode: start the next queued model before completing the round.
        if (!this.concurrent && this.pending.length > 0) {
          const next = this.pending.shift()!;
          this.generateFor(next, round);
          break;
        }
        if (this.doneThisRound.size >= MODEL_ORDER.length) {
          this.cb.onRoundComplete(round);
          if (round < 3) {
            this.runRound((round + 1) as Round);
          } else {
            this.cb.onDuelComplete(this.buildTranscript());
          }
        }
        break;
      }
      case "error":
        this.cb.onProgress(id, { state: "error", percent: 0, label: "Error" });
        this.cb.onError(id, msg.message ?? "Unknown error");
        break;
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
