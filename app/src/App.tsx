import { useEffect, useRef, useState } from "react";
import "./App.css";
import { DuelEngine, type ModelProgress } from "./lib/duel";
import { MODELS, MODEL_ORDER, type ModelId } from "./lib/models";

type Phase = "boot" | "loading" | "ready" | "dueling" | "done";

const DEFAULT_TOPIC = "Should AI write my LinkedIn posts?";

const emptyProgress: ModelProgress = {
  state: "idle",
  percent: 0,
  label: "—",
};

export default function App() {
  const engineRef = useRef<DuelEngine | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [webgpu, setWebgpu] = useState(true);

  const [progress, setProgress] = useState<Record<ModelId, ModelProgress>>({
    gemma: emptyProgress,
    qwen: emptyProgress,
  });
  const [output, setOutput] = useState<Record<ModelId, string>>({
    gemma: "",
    qwen: "",
  });
  const [errors, setErrors] = useState<Record<ModelId, string | null>>({
    gemma: null,
    qwen: null,
  });
  const [doneCount, setDoneCount] = useState(0);

  // Spin up the engine once. Token/progress callbacks push straight into state.
  useEffect(() => {
    const engine = new DuelEngine({
      onProgress: (id, p) => setProgress((prev) => ({ ...prev, [id]: p })),
      onToken: (id, text) =>
        setOutput((prev) => ({ ...prev, [id]: prev[id] + text })),
      onRoundDone: () => setDoneCount((c) => c + 1),
      onError: (id, message) =>
        setErrors((prev) => ({ ...prev, [id]: message })),
      onDevice: (device) => setWebgpu(device === "webgpu"),
    });
    engineRef.current = engine;
    setPhase("boot");
    return () => engine.dispose();
  }, []);

  // Flip to "ready" once both models finish loading.
  useEffect(() => {
    if (
      phase === "loading" &&
      progress.gemma.state === "ready" &&
      progress.qwen.state === "ready"
    ) {
      setPhase("ready");
    }
  }, [phase, progress]);

  // Both columns finished generating → duel done.
  useEffect(() => {
    if (phase === "dueling" && doneCount >= MODEL_ORDER.length) {
      setPhase("done");
    }
  }, [phase, doneCount]);

  function handleLoad() {
    setPhase("loading");
    engineRef.current?.load();
  }

  function handleStart() {
    if (!topic.trim()) return;
    setOutput({ gemma: "", qwen: "" });
    setErrors({ gemma: null, qwen: null });
    setDoneCount(0);
    setPhase("dueling");
    engineRef.current?.startDuel(topic.trim());
  }

  const loadingPct = Math.round(
    (progress.gemma.percent + progress.qwen.percent) / 2,
  );

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          Prompt<span className="duel">Duel</span>
        </h1>
        <p className="tagline">
          Two open-weight AIs argue your topic. In your browser. On-device. No
          cloud, no account.
        </p>
      </header>

      {!webgpu && (
        <div className="banner warn">
          WebGPU not detected — falling back to CPU (WASM). It will run, just
          slower. For the full experience use Chrome/Edge or Safari 18+.
        </div>
      )}

      <section className="controls">
        <input
          className="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type a debate topic…"
          disabled={phase === "dueling"}
        />
        {phase === "boot" && (
          <button className="primary" onClick={handleLoad}>
            Load models (~450MB, once)
          </button>
        )}
        {phase === "loading" && (
          <button className="primary" disabled>
            Loading… {loadingPct}%
          </button>
        )}
        {(phase === "ready" || phase === "done") && (
          <button className="primary" onClick={handleStart}>
            ⚔️ Start Duel
          </button>
        )}
        {phase === "dueling" && (
          <button className="primary" disabled>
            Dueling…
          </button>
        )}
      </section>

      <section className="arena">
        {MODEL_ORDER.map((id) => (
          <Column
            key={id}
            id={id}
            progress={progress[id]}
            text={output[id]}
            error={errors[id]}
            streaming={phase === "dueling"}
          />
        ))}
      </section>

      <footer className="foot">
        <span>
          {MODELS.gemma.displayName} ({MODELS.gemma.position}) vs{" "}
          {MODELS.qwen.displayName} ({MODELS.qwen.position}) · Phase 1 proof ·
          round 1 of 3
        </span>
      </footer>
    </div>
  );
}

function Column(props: {
  id: ModelId;
  progress: ModelProgress;
  text: string;
  error: string | null;
  streaming: boolean;
}) {
  const m = MODELS[props.id];
  const { progress, text, error } = props;

  return (
    <article className="column" style={{ borderTopColor: m.accent }}>
      <div className="col-head">
        <div>
          <div className="model-name" style={{ color: m.accent }}>
            {m.displayName}
          </div>
          <div className="model-vendor">{m.vendor}</div>
        </div>
        <div className="position" style={{ background: m.accent }}>
          {m.position}
        </div>
      </div>

      {progress.state === "loading" && (
        <div className="loadbar">
          <div
            className="loadbar-fill"
            style={{ width: `${progress.percent}%`, background: m.accent }}
          />
          <span className="loadbar-label">{progress.label}</span>
        </div>
      )}

      <div className="col-body">
        {error ? (
          <div className="col-error">⚠ {error}</div>
        ) : text ? (
          <p className="stream">
            {text}
            {props.streaming && <span className="cursor">▍</span>}
          </p>
        ) : (
          <div className="col-placeholder">
            {progress.state === "ready"
              ? `Ready to defend "${m.position}".`
              : progress.state === "loading"
                ? "Loading weights…"
                : "Waiting…"}
          </div>
        )}
      </div>
    </article>
  );
}
