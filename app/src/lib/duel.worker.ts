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
  /** Committed opener (e.g. "YES, because ") prefilled so the model can't flip. */
  prefill?: string;
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
    const prefill = msg.prefill ?? "";
    let full = prefill;
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        full += text;
        post({ type: "token", text });
      },
    });

    const genOpts = {
      // Tight cap → punchy 2-sentence arguments, less room to ramble (the
      // optimist persona) or leak a new round header.
      max_new_tokens: 72,
      do_sample: true,
      // Lower temperature → coherent, far less likely to drift off-position.
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 3,
      streamer,
    };

    if (prefill) {
      // Prefill the committed opener: apply the chat template, append the seed,
      // and let the model CONTINUE it. Continuing "YES, because …" makes it
      // almost impossible to flip to the other side.
      const promptText = generator.tokenizer.apply_chat_template(msg.messages, {
        tokenize: false,
        add_generation_prompt: true,
      }) as string;
      post({ type: "token", text: prefill });
      await generator(promptText + prefill, {
        ...genOpts,
        return_full_text: false,
      });
    } else {
      await generator(msg.messages as unknown as string, genOpts);
    }

    post({ type: "done", text: trimToSentence(full) });
  } catch (err) {
    post({ type: "error", phase: "generate", message: String(err) });
  }
}

/**
 * If generation hit the token cap mid-sentence, trim back to the last full
 * sentence so the argument doesn't end on a dangling fragment. Only trims when
 * it leaves a reasonable amount of text.
 */
function trimToSentence(text: string): string {
  const t = text.trim();
  if (/[.!?"'”’)]$/.test(t)) return t;
  const lastEnd = Math.max(
    t.lastIndexOf("."),
    t.lastIndexOf("!"),
    t.lastIndexOf("?"),
  );
  if (lastEnd > t.length * 0.5) return t.slice(0, lastEnd + 1);
  return t;
}

ctx.addEventListener("message", (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "load") void handleLoad(msg);
  else if (msg.type === "generate") void handleGenerate(msg);
});
