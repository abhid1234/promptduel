import { TopicInput } from "../components/TopicInput";
import { MODELS } from "../lib/models";

// Curated topics that reliably produce committed, entertaining debates.
// (Subset of docs/spec.md test prompts.)
export const SUGGESTED_TOPICS = [
  "Should AI write my LinkedIn posts?",
  "Is vibe coding real engineering?",
  "Is RAG dead?",
  "Will AGI arrive in 2027?",
  "Is on-device AI better than cloud AI?",
  "Does open-source AI win long-term?",
  "Are personal AI agents the next OS?",
  "Is voice the right primary interface for AI?",
];

interface HomeProps {
  topic: string;
  onTopicChange: (topic: string) => void;
  onStart: () => void;
  onPick: (topic: string) => void;
}

export function Home({ topic, onTopicChange, onStart, onPick }: HomeProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:pt-14">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Prompt
          <span className="bg-gradient-to-r from-yes to-no bg-clip-text text-transparent">
            Duel
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Two open-weight AIs argue your topic, side-by-side, over three rounds.
          In your browser. On-device. No cloud, no account.
        </p>
      </header>

      <TopicInput value={topic} onChange={onTopicChange} onSubmit={onStart} />

      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
          Or pick one
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="rounded-full border border-panelEdge bg-panel px-3 py-1.5 text-sm text-muted transition hover:border-yes hover:text-white"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-center gap-3 text-center text-xs text-faint">
        <span style={{ color: MODELS.gemma.accent }}>
          {MODELS.gemma.displayName}
        </span>
        <span>defends YES</span>
        <span className="opacity-40">vs</span>
        <span style={{ color: MODELS.qwen.accent }}>
          {MODELS.qwen.displayName}
        </span>
        <span>defends NO</span>
      </div>
    </div>
  );
}
