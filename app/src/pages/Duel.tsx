import { DebateColumn } from "../components/DebateColumn";
import { RoundIndicator } from "../components/RoundIndicator";
import { VoteBar } from "../components/VoteBar";
import { ShareButton, type ShareState } from "../components/ShareButton";
import { MODELS, MODEL_ORDER, type ModelId } from "../lib/models";
import type { ModelProgress } from "../lib/duel";
import type { Round } from "../lib/prompts";

export interface DuelViewProps {
  topic: string;
  /** null until the GPU probe resolves; false → WASM fallback banner. */
  webgpu: boolean | null;
  /** Mobile: models run one at a time (avoids GPU OOM) — show a small note. */
  sequential?: boolean;
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
            Mobile mode: models take turns (one at a time) for stability.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODEL_ORDER.map((id) => (
          <DebateColumn
            key={id}
            model={MODELS[id]}
            progress={progress[id]}
            rounds={texts[id]}
            activeRound={replay ? null : activeRound}
            error={errors[id]}
          />
        ))}
      </div>

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
                models={MODELS}
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
