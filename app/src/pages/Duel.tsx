import { Fragment } from "react";
import { RoundIndicator } from "../components/RoundIndicator";
import { VoteBar } from "../components/VoteBar";
import { ShareButton, type ShareState } from "../components/ShareButton";
import {
  MODELS,
  MODEL_ORDER,
  type ModelId,
  type ModelConfig,
} from "../lib/models";
import type { ModelProgress } from "../lib/duel";
import { ROUND_LABEL, type Round } from "../lib/prompts";
import { cleanArgument } from "../lib/format";

const ROUNDS: Round[] = [1, 2, 3];

export interface DuelViewProps {
  topic: string;
  /** null until the GPU probe resolves; false → WASM fallback banner. */
  webgpu: boolean | null;
  /** Mobile: models run one at a time (avoids GPU OOM) — show a small note. */
  sequential?: boolean;
  /** Which model hosts both sides in single-model mode (usually gemma). */
  hostId?: ModelId;
  progress: Record<ModelId, ModelProgress>;
  texts: Record<ModelId, Partial<Record<Round, string>>>;
  activeRound: Round | null;
  errors: Record<ModelId, string | null>;
  complete: boolean;
  voted: ModelId | null;
  onVote: (id: ModelId) => void;
  share: {
    enabled: boolean;
    state: ShareState;
    url: string | null;
    error: string | null;
    onShare: () => void;
  };
  onNewDuel: () => void;
  /** Static replay loaded from a permalink (no live generation running). */
  replay?: boolean;
  onRerun?: () => void;
  /** Report link is only meaningful once the duel has a persisted id. */
  canReport?: boolean;
  reported?: boolean;
  onReport?: () => void;
}

export function Duel(props: DuelViewProps) {
  const {
    topic,
    webgpu,
    sequential,
    hostId = "gemma",
    progress,
    texts,
    activeRound,
    errors,
    complete,
    voted,
    onVote,
    share,
    onNewDuel,
    replay,
    onRerun,
    canReport,
    reported,
    onReport,
  } = props;

  // In single-model mode one model plays both sides, so present them by PERSONA
  // ("The Optimist" / "The Skeptic", both powered by the host model) rather than
  // "Gemma vs Gemma". Used for the columns AND the vote bar so they match.
  const PERSONA_NAME: Record<ModelId, string> = {
    gemma: "The Optimist",
    qwen: "The Skeptic",
  };
  // The actual model doing the work in single-model mode (usually Gemma, but the
  // OOM fallback can make Qwen the host) — used as the honest subtitle.
  const hostName = MODELS[hostId].displayName;
  const displayModels: Record<ModelId, ModelConfig> = sequential
    ? {
        gemma: {
          ...MODELS.gemma,
          displayName: PERSONA_NAME.gemma,
          vendor: hostName,
        },
        qwen: {
          ...MODELS.qwen,
          displayName: PERSONA_NAME.qwen,
          vendor: hostName,
        },
      }
    : MODELS;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <button
          onClick={onNewDuel}
          className="shrink-0 rounded-lg border border-panelEdge bg-panel px-3 py-1.5 text-sm text-muted transition hover:text-white"
        >
          ← New duel
        </button>
        <h1 className="flex-1 text-right text-lg font-bold leading-tight sm:text-xl">
          {topic}
        </h1>
      </div>

      {webgpu === false && (
        <div className="mb-4 rounded-xl border border-[#6b4f24] bg-[#3a2a12] px-4 py-3 text-sm leading-relaxed text-[#ffce88]">
          WebGPU not available — running on CPU (WASM). It works, just slower.
          For full speed use Chrome/Edge desktop or mobile, or Safari 18+.
        </div>
      )}

      <div className="mb-5">
        <RoundIndicator activeRound={activeRound} complete={complete} />
        {sequential && (
          <p className="mt-2 text-center text-xs text-faint">
            Both personas are powered by {hostName} — this device can't fit two
            models, so one plays both sides, taking turns.
          </p>
        )}
      </div>

      {/* Round-major grid: each round is a row with both sides side-by-side at
          equal height, so Opening/Rebuttal/Closing line up across columns. */}
      <section className="grid grid-cols-1 items-stretch gap-x-4 gap-y-3 sm:grid-cols-2">
        {/* Model headers */}
        {MODEL_ORDER.map((id) => {
          const m = displayModels[id];
          const p = progress[id];
          return (
            <div
              key={`head-${id}`}
              className="rounded-xl border border-panelEdge bg-panel px-4 py-3"
              style={{ borderTopColor: m.accent, borderTopWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    className="text-[1.05rem] font-extrabold"
                    style={{ color: m.accent }}
                  >
                    {m.displayName}
                  </div>
                  <div className="text-xs text-faint">{m.vendor}</div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wide text-white"
                  style={{ background: m.accent }}
                >
                  {m.position}
                </span>
              </div>
              {p.state === "loading" && (
                <div className="relative mt-3 h-5 overflow-hidden rounded-md bg-[#1c2230]">
                  <div
                    className="h-full transition-[width] duration-200"
                    style={{ width: `${p.percent}%`, background: m.accent }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[0.7rem] text-[#d7dce6]">
                    {p.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* One row per round (revealed as the duel reaches it) */}
        {ROUNDS.filter(
          (r) => texts.gemma[r] || texts.qwen[r] || activeRound === r,
        ).map((r) => (
          <Fragment key={`round-${r}`}>
            <div className="col-span-1 mt-1 flex items-center gap-3 sm:col-span-2">
              <div className="h-px flex-1 bg-panelEdge" />
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-faint">
                {ROUND_LABEL[r]}
              </span>
              <div className="h-px flex-1 bg-panelEdge" />
            </div>
            {MODEL_ORDER.map((id) => {
              const m = displayModels[id];
              const text = texts[id][r];
              const isActive = !replay && activeRound === r;
              const err = errors[id];
              return (
                <div
                  key={`cell-${id}-${r}`}
                  className="rounded-xl border border-panelEdge bg-panel p-4"
                  style={{ borderLeft: `3px solid ${m.accent}` }}
                >
                  {err ? (
                    <div className="text-sm leading-relaxed break-words text-[#ff8c8c]">
                      ⚠ {err}
                    </div>
                  ) : text || isActive ? (
                    <p className="m-0 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-[#e7eaf0]">
                      {cleanArgument(text ?? "")}
                      {isActive && (
                        <span className="stream-cursor text-[#8a93a6]">▍</span>
                      )}
                    </p>
                  ) : (
                    <span className="text-sm text-faint italic">…</span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </section>

      {(complete || replay) && (
        <div className="mx-auto mt-6 max-w-md space-y-4">
          {replay ? (
            <button
              onClick={onRerun}
              className="w-full rounded-xl bg-gradient-to-r from-yes to-no px-4 py-3 text-base font-bold text-white transition hover:brightness-110"
            >
              ⚔️ Re-run this duel live
            </button>
          ) : (
            <>
              <VoteBar
                models={displayModels}
                enabled={complete}
                voted={voted}
                onVote={onVote}
              />
              <ShareButton
                enabled={share.enabled}
                state={share.state}
                url={share.url}
                error={share.error}
                onShare={share.onShare}
              />
            </>
          )}

          {canReport && (
            <div className="text-center">
              <button
                onClick={onReport}
                disabled={reported}
                className="text-xs text-faint underline-offset-2 hover:text-muted hover:underline disabled:no-underline"
              >
                {reported ? "Reported — thanks" : "Report this duel"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
