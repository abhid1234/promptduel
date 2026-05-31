import type { ModelId } from "./models";

export interface DuelTranscript {
  id?: string;
  topic: string;
  models: {
    A: ModelId;
    B: ModelId;
  };
  transcript: {
    round: number;
    A: string;
    B: string;
  }[];
  seeds: {
    A: number;
    B: number;
  };
  votes?: {
    A: number;
    B: number;
  };
  createdAt?: string;
}

// In development, the Vite server runs on a different port than Wrangler dev.
// We allow configuring VITE_API_URL, defaulting to relative path in production.
const API_BASE = (import.meta.env.VITE_API_URL as string) || "";

export async function saveDuel(duel: DuelTranscript): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/api/save-duel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(duel),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to save duel" }));
    throw new Error((err as any).error || `Save failed with status ${response.status}`);
  }

  return response.json();
}

export async function loadDuel(id: string): Promise<DuelTranscript> {
  const response = await fetch(`${API_BASE}/api/duel/${id}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to load duel" }));
    throw new Error((err as any).error || `Load failed with status ${response.status}`);
  }

  return response.json();
}

export async function recordVote(id: string, winner: "A" | "B"): Promise<void> {
  const response = await fetch(`${API_BASE}/api/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ duel_id: id, winner }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to record vote" }));
    throw new Error((err as any).error || `Vote failed with status ${response.status}`);
  }
}

export async function getTopicOfTheDay(): Promise<{ topic: string; updatedAt: string }> {
  const response = await fetch(`${API_BASE}/api/topic-of-the-day`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to get topic of the day" }));
    throw new Error((err as any).error || `Fetch failed with status ${response.status}`);
  }

  return response.json();
}

export async function getCuratedTopics(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/curated-topics`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to get curated topics" }));
    throw new Error((err as any).error || `Fetch failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.topics;
}

export async function reportDuel(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ duel_id: id }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to report duel" }));
    throw new Error((err as any).error || `Report failed with status ${response.status}`);
  }
}

export async function recordStartDuel(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/telemetry/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to record start telemetry" }));
    throw new Error((err as any).error || `Telemetry failed with status ${response.status}`);
  }
}


