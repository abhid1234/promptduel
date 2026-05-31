// Model configuration for the v1 duel: cross-vendor pairing is the secret sauce.
// Gemma 3 270M IT (defend YES) vs Qwen 2.5 0.5B Instruct (defend NO).
//
// NOTE: the spec calls the first model "Gemma 4 270M" but the real, ONNX/WebGPU-
// available model is Gemma *3* 270M IT — there is no Gemma 4 270M. Same role,
// same ~150MB int4 footprint, still open-weight + on-device. Flagged in STATUS.md.

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
    repo: "onnx-community/gemma-3-270m-it-ONNX",
    dtype: "q4",
    displayName: "Gemma 3 270M",
    vendor: "Google",
    position: "YES",
    supportsSystemRole: false,
    accent: "#4f8cff",
  },
  qwen: {
    id: "qwen",
    repo: "onnx-community/Qwen2.5-0.5B-Instruct",
    dtype: "q4",
    displayName: "Qwen 2.5 0.5B",
    vendor: "Alibaba",
    position: "NO",
    supportsSystemRole: true,
    accent: "#ff5c7a",
  },
};

export const MODEL_ORDER: ModelId[] = ["gemma", "qwen"];
