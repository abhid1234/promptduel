// Adversarial prompt templates — the secret of why PromptDuel works.
// Small models (270M/0.5B) hedge AND pad with generic filler. These prompts
// force commitment, concision, and specifics. See docs/spec.md.

export type Position = "YES" | "NO";
export type Round = 1 | 2 | 3;

export const ROUND_INSTRUCTION: Record<Round, string> = {
  1: "OPENING. Your single strongest, most specific point.",
  2: "ESCALATE. A NEW, sharper point — different from before. Be aggressive.",
  3: "CLOSING. Your most convincing one-liner. No new facts, just conviction.",
};

export const ROUND_LABEL: Record<Round, string> = {
  1: "Opening",
  2: "Rebuttal",
  3: "Closing",
};

/**
 * The system instruction. Kept LEAN on purpose: testing showed 270M/0.5B models
 * collapse into meta-commentary when given long rule-stacks. A short, firm
 * prompt with the stance spelled out as an explicit verdict works best —
 * it keeps them on the right side and actually arguing.
 */
function systemInstruction(
  position: Position,
  topic: string,
  round: Round,
): string {
  // "Argue YES" is too abstract — small models drift to the wrong side. Spell
  // out the verdict and repeat it.
  const verdict = position === "YES" ? "YES" : "NO";
  const opposite = position === "YES" ? "NO" : "YES";

  return [
    `Debate topic: "${topic}".`,
    `You say the answer is ${verdict}. Defend ${verdict}, attack ${opposite}. Never agree with ${opposite}. Never hedge.`,
    "",
    `Give ONE specific reason — a real example, number, or consequence. Be blunt. 2-3 short sentences MAX. No "it depends", no restating the question.`,
    "",
    `Round ${round} of 3 — ${ROUND_INSTRUCTION[round]}`,
  ].join("\n");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Build the chat messages for one model's turn.
 *
 * Gemma has no `system` role in its chat template, so for models without
 * system-role support we fold the instruction into the first user turn.
 * Qwen supports a real system role.
 */
export function buildMessages(opts: {
  position: Position;
  topic: string;
  round: Round;
  /** Unused: feeding the opponent's text hijacks weak models into switching
   * sides. Each round the model argues its OWN side harder instead. Kept for
   * API compatibility with the orchestrator. */
  opponentLast?: string;
  supportsSystemRole: boolean;
}): ChatMessage[] {
  const { position, topic, round, supportsSystemRole } = opts;
  const verdict = position; // "YES" | "NO"
  const system = systemInstruction(position, topic, round);
  const userBody = `Argue that the answer is ${verdict}.`;

  if (supportsSystemRole) {
    return [
      { role: "system", content: system },
      { role: "user", content: userBody },
    ];
  }
  return [{ role: "user", content: `${system}\n\n${userBody}` }];
}

/** The committed opener the worker prefills so the model can't flip mid-argument. */
export function stancePrefill(position: Position): string {
  return `${position}, because `;
}
