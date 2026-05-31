// Adversarial prompt templates — the secret of why PromptDuel works.
// Small models love to hedge. These prompts FORCE position commitment.
// See docs/spec.md "Adversarial prompt template" for the locked design.

export type Position = "YES" | "NO";
export type Round = 1 | 2 | 3;

export const ROUND_INSTRUCTION: Record<Round, string> = {
  1: "Make your strongest opening case. Stake out your position with 2-3 concrete points.",
  2: "Read the opponent's opening above. Pick 1-2 of their strongest points and dismantle them. End with one counter-argument.",
  3: "Make your final case. Why is your position correct despite the opponent's challenge? End on conviction.",
};

export const ROUND_LABEL: Record<Round, string> = {
  1: "Opening",
  2: "Rebuttal",
  3: "Closing",
};

/**
 * The system instruction that forces commitment. Kept aggressive on purpose —
 * the "you are NEVER neutral" line is what keeps 270M/0.5B models off the fence.
 */
function systemInstruction(
  position: Position,
  topic: string,
  round: Round,
): string {
  return [
    `You are debating in a structured duel. You MUST argue ONLY for answering "${position}" to the topic.`,
    "",
    "Rules:",
    '- You are NEVER neutral. NEVER say "I respect your perspective" or "both sides have merit."',
    "- You MUST attack specific points the other model made (when applicable).",
    "- You MUST commit to your assigned position even if you doubt it.",
    "- Stay civil — no insults, no slurs. Sharp disagreement is fine and expected.",
    "- Keep your response to 120-180 words. Do not exceed it.",
    `- This is round ${round} of 3: ${ROUND_INSTRUCTION[round]}`,
    "",
    `Topic: ${topic}`,
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
  opponentLast?: string;
  supportsSystemRole: boolean;
}): ChatMessage[] {
  const { position, topic, round, opponentLast, supportsSystemRole } = opts;
  const system = systemInstruction(position, topic, round);

  const userBody =
    opponentLast && round > 1
      ? `Your opponent just argued:\n"""\n${opponentLast.trim()}\n"""\n\nNow give your round ${round} argument.`
      : `Give your round ${round} argument.`;

  if (supportsSystemRole) {
    return [
      { role: "system", content: system },
      { role: "user", content: userBody },
    ];
  }
  return [{ role: "user", content: `${system}\n\n${userBody}` }];
}
