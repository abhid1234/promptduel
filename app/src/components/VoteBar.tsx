import type { ModelConfig, ModelId } from "../lib/models";

interface VoteBarProps {
  models: Record<ModelId, ModelConfig>;
  /** Votes can only be cast once the duel has finished. */
  enabled: boolean;
  /** The side the user already voted for, if any. */
  voted: ModelId | null;
  onVote: (winner: ModelId) => void;
}

/** "Who won?" — one button per model. Locks after a vote. */
export function VoteBar({ models, enabled, voted, onVote }: VoteBarProps) {
  return (
    <div className="space-y-2">
      <div className="text-center text-sm font-semibold text-muted">
        {voted
          ? "Thanks for voting!"
          : enabled
            ? "Who won?"
            : "Vote opens when the duel ends"}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(models) as ModelId[]).map((id) => {
          const m = models[id];
          const isChoice = voted === id;
          const dimmed = voted !== null && !isChoice;
          return (
            <button
              key={id}
              disabled={!enabled || voted !== null}
              onClick={() => onVote(id)}
              className={[
                "rounded-xl border-2 px-4 py-3 text-sm font-bold transition",
                "disabled:cursor-default",
                dimmed ? "opacity-40" : "",
                !enabled && !voted ? "opacity-50" : "",
                "hover:enabled:brightness-110",
              ].join(" ")}
              style={{
                borderColor: m.accent,
                background: isChoice ? m.accent : "transparent",
                color: isChoice ? "#fff" : m.accent,
              }}
            >
              {isChoice ? "👑 " : ""}
              {m.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
