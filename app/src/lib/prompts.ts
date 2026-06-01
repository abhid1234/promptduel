// Adversarial prompt templates — the secret of why PromptDuel works.
// Small models (270M/0.5B) hedge AND pad with generic filler. These prompts
// force commitment, concision, and specifics. See docs/spec.md.

export type Position = "YES" | "NO";
export type Round = 1 | 2 | 3;

export const ROUND_INSTRUCTION: Record<Round, string> = {
  1: "OPENING. Hit your two strongest, most specific points. Lead with the sharpest one.",
  2: "REBUTTAL. Name the opponent's weakest claim and tear it apart in one sentence. Then land one new point they can't answer.",
  3: "CLOSING. One decisive line on why you win. No new arguments. No summary.",
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
    `Start your reply with "${verdict}". Then give 2 specific reasons — use a real example, number, or consequence. Be blunt. Short sentences. No "it depends", no restating the question.`,
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
  opponentLast?: string;
  supportsSystemRole: boolean;
}): ChatMessage[] {
  const { position, topic, round, opponentLast, supportsSystemRole } = opts;
  const system = systemInstruction(position, topic, round);

  const userBody =
    opponentLast && round > 1
      ? `Your opponent just argued:\n"""\n${opponentLast.trim()}\n"""\n\nDemolish it and make your round ${round} case. Be specific and brief.`
      : `Make your round ${round} case. Be specific and brief.`;

  if (supportsSystemRole) {
    return [
      { role: "system", content: system },
      { role: "user", content: userBody },
    ];
  }
  return [{ role: "user", content: `${system}\n\n${userBody}` }];
}
