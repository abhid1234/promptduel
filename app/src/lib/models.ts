// Model configuration for the v1 duel: cross-vendor pairing is the secret sauce.
// Gemma 3 1B IT (defend YES) vs Qwen 2.5 1.5B Instruct (defend NO).
//
// UPGRADED from 270M/0.5B: local testing showed the sub-500M models argue the
// wrong side and stay generic — a capability ceiling no prompt could fix. The
// 1B/1.5B pair produces concise, specific, on-position arguments. Trade-off:
// ~1.7GB total download (was ~450MB), so "runs on any phone" becomes "desktop +
// high-end phones." Overrides the original <500MB decision — see STATUS.md.

import type { Position } from "./prompts";

export type ModelId = "gemma" | "qwen";

export interface ModelConfig {
  id: ModelId;
  /** HuggingFace repo with ONNX weights for Transformers.js. */
  repo: string;
  /** Quantization to load. q4 = int4, broadly compatible on mobile WebGPU. */
  dtype: "q4" | "q4f16" | "fp16" | "q8";
  displayName: string;
  vendor: string;
  /** Side this model defends in v1 (hardcoded for the Phase 1 proof). */
  position: Position;
  /** Gemma's chat template has no system role; Qwen's does. */
  supportsSystemRole: boolean;
  /** Accent color for the column (Tailwind-free inline styling). */
  accent: string;
}

export const MODELS: Record<ModelId, ModelConfig> = {
  gemma: {
    id: "gemma",
    repo: "onnx-community/gemma-3-1b-it-ONNX",
    dtype: "q4",
    displayName: "Gemma 3 1B",
    vendor: "Google",
    position: "YES",
    supportsSystemRole: false,
    accent: "#4f8cff",
  },
  qwen: {
    id: "qwen",
    repo: "onnx-community/Qwen2.5-1.5B-Instruct",
    dtype: "q4",
    displayName: "Qwen 2.5 1.5B",
    vendor: "Alibaba",
    position: "NO",
    supportsSystemRole: true,
    accent: "#ff5c7a",
  },
};

export const MODEL_ORDER: ModelId[] = ["gemma", "qwen"];
