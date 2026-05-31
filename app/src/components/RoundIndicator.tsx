import { ROUND_LABEL, type Round } from "../lib/prompts";

const ALL_ROUNDS: Round[] = [1, 2, 3];

interface RoundIndicatorProps {
  /** Round currently generating, or null before start / after finish. */
  activeRound: Round | null;
  /** True once all three rounds are done. */
  complete: boolean;
}

/** Opening · Rebuttal · Closing progress pills (1/3 → 3/3). */
export function RoundIndicator({ activeRound, complete }: RoundIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {ALL_ROUNDS.map((r) => {
        const done = complete || (activeRound !== null && r < activeRound);
        const active = activeRound === r;
        return (
          <div
            key={r}
            className={[
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-transparent bg-gradient-to-r from-yes to-no text-white"
                : done
                  ? "border-panelEdge bg-panel text-white"
                  : "border-panelEdge bg-transparent text-faint",
            ].join(" ")}
          >
            <span className="tabular-nums opacity-70">{r}/3</span>
            <span>{ROUND_LABEL[r]}</span>
            {done && <span className="text-yes">✓</span>}
          </div>
        );
      })}
    </div>
  );
}
