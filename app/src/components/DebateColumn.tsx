import type { ModelConfig } from "../lib/models";
import type { ModelProgress } from "../lib/duel";
import { ROUND_LABEL, type Round } from "../lib/prompts";

const ALL_ROUNDS: Round[] = [1, 2, 3];

/**
 * Clean up small-model output for display (applied to the whole accumulated
 * string each render, so it stays clean even mid-stream):
 * - cut off any leaked next-round header the model spills ("Round 3", "Escalation"…)
 * - strip markdown tokens (**bold**, ### headers, `code`, > quotes)
 * - scrub absurd invented years/dates the prompt told it not to write
 *   (keeps 2000-2099 like a topic's "2027"; removes 2127, 22048, etc.)
 */
function cleanArgument(text: string): string {
  let t = text;
  const leak = t.match(
    /\n+\s*(?:[-—]+\s*)?(?:round\s*\d|opening|rebuttal|closing|escalat)/i,
  );
  if (leak && leak.index !== undefined) t = t.slice(0, leak.index);
  const MONTH =
    "January|February|March|April|May|June|July|August|September|October|November|December";
  t = t
    .replace(/<\/?[a-z][^>]*>/gi, "") // HTML tags (<b>, <i>) the model sometimes emits
    .replace(/[`*_]/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    // whole invented date phrases: "by 24th December, 2688", "in December 2485"
    .replace(
      new RegExp(
        `\\b(?:by|on|in|around|before|after|until)\\s+(?:the\\s+)?(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?(?:of\\s+)?(?:${MONTH})\\w*,?\\s*\\d{0,4}`,
        "gi",
      ),
      "",
    )
    .replace(new RegExp(`\\b(?:${MONTH})\\w*,?\\s*\\d{2,4}`, "gi"), "")
    // stray absurd years (keeps 2000-2099 like a topic's "2027")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\b(?:2[1-9]\d{2}|[3-9]\d{3})\b/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1");
  return t;
}

interface DebateColumnProps {
  model: ModelConfig;
  progress: ModelProgress;
  /** Accumulated (streaming) text per round for this model. */
  rounds: Partial<Record<Round, string>>;
  /** Round currently generating, or null when idle/done. */
  activeRound: Round | null;
  error?: string | null;
}

/** One model's side of the arena: header, load progress, 3 stacked rounds. */
export function DebateColumn({
  model,
  progress,
  rounds,
  activeRound,
  error,
}: DebateColumnProps) {
  const hasAnyText = ALL_ROUNDS.some((r) => rounds[r]);

  return (
    <article
      className="flex min-h-[18rem] flex-col rounded-2xl border border-panelEdge bg-panel p-4"
      style={{ borderTopColor: model.accent, borderTopWidth: 3 }}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div
            className="text-[1.05rem] font-extrabold"
            style={{ color: model.accent }}
          >
            {model.displayName}
          </div>
          <div className="text-xs text-faint">{model.vendor}</div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wide text-white"
          style={{ background: model.accent }}
        >
          {model.position}
        </span>
      </header>

      {progress.state === "loading" && (
        <div className="relative mb-3 h-5.5 overflow-hidden rounded-md bg-[#1c2230]">
          <div
            className="h-full transition-[width] duration-200"
            style={{ width: `${progress.percent}%`, background: model.accent }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[0.7rem] text-[#d7dce6]">
            {progress.label}
          </span>
        </div>
      )}

      <div className="flex-1 space-y-3">
        {error ? (
          <div className="text-sm leading-relaxed text-[#ff8c8c] break-words">
            ⚠ {error}
          </div>
        ) : hasAnyText ? (
          ALL_ROUNDS.filter((r) => rounds[r] || r === activeRound).map((r) => (
            <div key={r}>
              <div className="mb-1 text-[0.7rem] font-bold uppercase tracking-wider text-faint">
                {ROUND_LABEL[r]}
              </div>
              <p className="m-0 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-[#e7eaf0]">
                {cleanArgument(rounds[r] ?? "")}
                {activeRound === r && (
                  <span className="stream-cursor text-[#8a93a6]">▍</span>
                )}
              </p>
            </div>
          ))
        ) : (
          <div className="text-sm italic text-faint">
            {progress.state === "ready"
              ? `Ready to defend "${model.position}".`
              : progress.state === "loading"
                ? "Loading weights…"
                : "Waiting…"}
          </div>
        )}
      </div>
    </article>
  );
}
