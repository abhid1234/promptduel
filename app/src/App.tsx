import { useEffect, useRef, useState } from "react";
import { Home } from "./pages/Home";
import { Duel } from "./pages/Duel";
import { DuelEngine, type ModelProgress } from "./lib/duel";
import { type ModelId } from "./lib/models";
import type { Round } from "./lib/prompts";
import {
  saveDuel,
  loadDuel,
  recordVote,
  recordStartDuel,
  reportDuel,
  type DuelTranscript,
} from "./lib/storage";
import type { ShareState } from "./components/ShareButton";

type View = "home" | "duel";

const IDLE_PROGRESS: ModelProgress = { state: "idle", percent: 0, label: "—" };

function emptyProgress(): Record<ModelId, ModelProgress> {
  return { gemma: IDLE_PROGRESS, qwen: IDLE_PROGRESS };
}
function emptyTexts(): Record<ModelId, Partial<Record<Round, string>>> {
  return { gemma: {}, qwen: {} };
}
function emptyErrors(): Record<ModelId, string | null> {
  return { gemma: null, qwen: null };
}

function parseDuelId(): string | null {
  const m = window.location.pathname.match(/^\/duel\/([^/]+)$/);
  return m ? m[1] : null;
}

export default function App() {
  const engineRef = useRef<DuelEngine | null>(null);
  const transcriptRef = useRef<DuelTranscript | null>(null);
  const savedIdRef = useRef<string | null>(null);
  const pendingTopicRef = useRef<string>("");
  const modelsLoadedRef = useRef(false);
  const votedRef = useRef<ModelId | null>(null);

  const [view, setView] = useState<View>(() =>
    parseDuelId() ? "duel" : "home",
  );
  const [replay, setReplay] = useState<boolean>(() => parseDuelId() !== null);
  const [topic, setTopic] = useState("Should AI write my LinkedIn posts?");
  const [webgpu, setWebgpu] = useState<boolean | null>(null);
  const [concurrent, setConcurrent] = useState(true);

  const [progress, setProgress] = useState(emptyProgress);
  const [texts, setTexts] = useState(emptyTexts);
  const [errors, setErrors] = useState(emptyErrors);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [complete, setComplete] = useState(false);

  const [voted, setVoted] = useState<ModelId | null>(null);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  // Spin up the engine once.
  useEffect(() => {
    const engine = new DuelEngine({
      onProgress: (id, p) => setProgress((prev) => ({ ...prev, [id]: p })),
      onDevice: (device) => setWebgpu(device === "webgpu"),
      onMode: (isConcurrent) => setConcurrent(isConcurrent),
      onToken: (id, round, text) => {
        setActiveRound(round);
        setTexts((prev) => ({
          ...prev,
          [id]: { ...prev[id], [round]: (prev[id][round] ?? "") + text },
        }));
      },
      onRoundComplete: () => {},
      onDuelComplete: (t) => {
        transcriptRef.current = t;
        setActiveRound(null);
        setComplete(true);
      },
      onError: (id, message) =>
        setErrors((prev) => ({ ...prev, [id]: message })),
    });
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  // Once both models report ready while we're waiting to start, kick off.
  useEffect(() => {
    if (
      !replay &&
      pendingTopicRef.current &&
      progress.gemma.state === "ready" &&
      progress.qwen.state === "ready"
    ) {
      modelsLoadedRef.current = true;
      const t = pendingTopicRef.current;
      pendingTopicRef.current = "";
      engineRef.current?.startDuel(t);
    }
  }, [progress, replay]);

  // Permalink: /duel/:id → load the stored transcript and show it statically.
  useEffect(() => {
    const id = parseDuelId();
    if (!id) return;
    loadDuel(id)
      .then((d) => {
        transcriptRef.current = d;
        setTopic(d.topic);
        const next = emptyTexts();
        for (const row of d.transcript) {
          next[d.models.A][row.round as Round] = row.A;
          next[d.models.B][row.round as Round] = row.B;
        }
        setTexts(next);
        setComplete(true);
        setProgress({
          gemma: { state: "ready", percent: 100, label: "Ready" },
          qwen: { state: "ready", percent: 100, label: "Ready" },
        });
      })
      .catch(() => {
        // Saved duel not found / worker offline — fall back to a fresh start.
        window.history.replaceState(null, "", "/");
        setReplay(false);
        setView("home");
      });
  }, []);

  function resetDuelState() {
    transcriptRef.current = null;
    savedIdRef.current = null;
    votedRef.current = null;
    setTexts(emptyTexts());
    setErrors(emptyErrors());
    setActiveRound(null);
    setComplete(false);
    setVoted(null);
    setShareState("idle");
    setShareUrl(null);
    setShareError(null);
    setReported(false);
  }

  function beginDuel(nextTopic: string) {
    const t = nextTopic.trim();
    if (!t) return;
    resetDuelState();
    setTopic(t);
    setReplay(false);
    setView("duel");
    // Funnel metric: count started duels (best-effort, no-op if worker offline).
    recordStartDuel().catch(() => {});
    if (modelsLoadedRef.current) {
      engineRef.current?.startDuel(t);
    } else {
      pendingTopicRef.current = t;
      engineRef.current?.load();
    }
  }

  function handleNewDuel() {
    window.history.replaceState(null, "", "/");
    resetDuelState();
    setReplay(false);
    setView("home");
  }

  function handleVote(id: ModelId) {
    if (voted) return;
    setVoted(id);
    votedRef.current = id;
    if (savedIdRef.current) {
      recordVote(savedIdRef.current, id === "gemma" ? "A" : "B").catch(
        () => {},
      );
    }
  }

  async function handleShare() {
    if (!transcriptRef.current) return;
    setShareState("saving");
    setShareError(null);
    try {
      const { id } = await saveDuel(transcriptRef.current);
      savedIdRef.current = id;
      if (votedRef.current) {
        await recordVote(id, votedRef.current === "gemma" ? "A" : "B").catch(
          () => {},
        );
      }
      const url = `${window.location.origin}/duel/${id}`;
      window.history.pushState(null, "", `/duel/${id}`);
      setShareUrl(url);
      setShareState("saved");
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
      setShareState("error");
    }
  }

  function handleReport() {
    const id = savedIdRef.current ?? parseDuelId();
    if (!id || reported) return;
    setReported(true);
    reportDuel(id).catch(() => {});
  }

  if (view === "home") {
    return (
      <Home
        topic={topic}
        onTopicChange={setTopic}
        onStart={() => beginDuel(topic)}
        onPick={(t) => {
          setTopic(t);
          beginDuel(t);
        }}
      />
    );
  }

  return (
    <Duel
      topic={topic}
      webgpu={webgpu}
      sequential={!concurrent}
      progress={progress}
      texts={texts}
      activeRound={activeRound}
      errors={errors}
      complete={complete}
      voted={voted}
      onVote={handleVote}
      share={{
        enabled: complete && !!transcriptRef.current,
        state: shareState,
        url: shareUrl,
        error: shareError,
        onShare: handleShare,
      }}
      onNewDuel={handleNewDuel}
      replay={replay}
      onRerun={() => beginDuel(topic)}
      canReport={(complete || replay) && (!!savedIdRef.current || replay)}
      reported={reported}
      onReport={handleReport}
    />
  );
}
