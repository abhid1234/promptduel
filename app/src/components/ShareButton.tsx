import { useState } from "react";

export type ShareState = "idle" | "saving" | "saved" | "error";

interface ShareButtonProps {
  enabled: boolean;
  state: ShareState;
  /** Permalink once saved (null until the worker returns an id). */
  url: string | null;
  error?: string | null;
  onShare: () => void;
}

/** Saves the duel to the worker and surfaces a copyable permalink. */
export function ShareButton({
  enabled,
  state,
  url,
  error,
  onShare,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — link is still shown.
    }
  }

  if (state === "saved" && url) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-panelEdge bg-panel p-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-muted outline-none"
        />
        <button
          onClick={copy}
          className="whitespace-nowrap rounded-lg bg-gradient-to-r from-yes to-no px-3 py-2 text-sm font-bold text-white"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        disabled={!enabled || state === "saving"}
        onClick={onShare}
        className="w-full rounded-xl border border-panelEdge bg-panel px-4 py-3 text-sm font-bold text-white transition hover:enabled:border-yes disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "🔗 Share this duel"}
      </button>
      {state === "error" && (
        <div className="text-center text-xs text-[#ff8c8c]">
          {error || "Couldn't save — is the worker running?"}
        </div>
      )}
    </div>
  );
}
