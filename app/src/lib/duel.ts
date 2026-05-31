// Duel orchestration. For the Phase 1 proof this runs ONE round (opening) and
// fans a single topic out into two adversarial prompts that stream concurrently.
// The 3-round loop (rebuttal → closing) is Phase 2 — the worker protocol and
// buildMessages() already take a round arg, so extending is additive.

import { MODELS, MODEL_ORDER, type ModelId } from "./models";
import { buildMessages, type Round } from "./prompts";
import type { ProgressInfo } from "@huggingface/transformers";

export type LoadState = "idle" | "loading" | "ready" | "error";

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
  onToken: (id: ModelId, text: string) => void;
  onRoundDone: (id: ModelId, full: string) => void;
  onError: (id: ModelId, message: string) => void;
  /** Fired once the real compute backend is known (after adapter probe). */
  onDevice: (device: Device) => void;
}

export type Device = "webgpu" | "wasm";

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

  /** Probe the GPU, report the chosen backend, then kick off both downloads. */
  async load() {
    const device = await detectDevice();
    this.cb.onDevice(device);
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

  /** Phase 1: opening round only. Both models fire at once. */
  startDuel(topic: string) {
    for (const id of MODEL_ORDER) {
      const m = MODELS[id];
      const messages = buildMessages({
        position: m.position,
        topic,
        round: 1 as Round,
        supportsSystemRole: m.supportsSystemRole,
      });
      this.workers[id].postMessage({ type: "generate", messages });
    }
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
        } else if (p && p.status === "ready") {
          // pipeline ready signal also arrives as our explicit "ready" below
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
        this.cb.onToken(id, msg.text ?? "");
        break;
      case "done":
        this.cb.onRoundDone(id, msg.text ?? "");
        break;
      case "error":
        this.cb.onProgress(id, {
          state: "error",
          percent: 0,
          label: "Error",
        });
        this.cb.onError(id, msg.message ?? "Unknown error");
        break;
    }
  }

  get bothReady(): boolean {
    return this.readyCount >= MODEL_ORDER.length;
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
