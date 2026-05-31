/// <reference lib="webworker" />
// One model lives in one worker → two workers = two genuinely parallel WebGPU
// contexts that stream concurrently without blocking each other or the UI thread.
//
// Loaded as an ESM module worker via `new Worker(new URL(...), { type: "module" })`
// in duel.ts. We import the library normally here (NOT self.import / importScripts),
// per feedback_odml_mediapipe_constraints.md — the blob/ESM-module pattern keeps
// streaming + WebGPU + Workers working.

import {
  pipeline,
  TextStreamer,
  type TextGenerationPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

import type { ChatMessage } from "./prompts";

type Device = "webgpu" | "wasm";

interface LoadMsg {
  type: "load";
  repo: string;
  dtype: "q4" | "q4f16" | "fp16" | "q8";
  device: Device;
}
interface GenerateMsg {
  type: "generate";
  messages: ChatMessage[];
}
type InMsg = LoadMsg | GenerateMsg;

let generator: TextGenerationPipeline | null = null;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: Record<string, unknown>) {
  ctx.postMessage(msg);
}

async function handleLoad(msg: LoadMsg) {
  try {
    generator = (await pipeline("text-generation", msg.repo, {
      dtype: msg.dtype,
      device: msg.device,
      progress_callback: (p: ProgressInfo) => {
        // Forward download/compile progress so the UI can show a real bar —
        // first load pulls ~150-300MB, this is the slow part for the user.
        post({ type: "load-progress", info: p });
      },
    })) as TextGenerationPipeline;

    post({ type: "ready" });
  } catch (err) {
    post({ type: "error", phase: "load", message: String(err) });
  }
}

async function handleGenerate(msg: GenerateMsg) {
  if (!generator) {
    post({ type: "error", phase: "generate", message: "Model not loaded yet" });
    return;
  }
  try {
    let full = "";
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        full += text;
        post({ type: "token", text });
      },
    });

    await generator(msg.messages as unknown as string, {
      max_new_tokens: 256,
      do_sample: true,
      temperature: 0.8,
      top_p: 0.9,
      repetition_penalty: 1.1,
      streamer,
    });

    post({ type: "done", text: full });
  } catch (err) {
    post({ type: "error", phase: "generate", message: String(err) });
  }
}

ctx.addEventListener("message", (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "load") void handleLoad(msg);
  else if (msg.type === "generate") void handleGenerate(msg);
});
