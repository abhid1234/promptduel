// Adversarial prompt templates — the secret of why PromptDuel works.
// Small models (270M/0.5B) hedge AND pad with generic filler. These prompts
// force commitment, concision, and specifics. See docs/spec.md.

export type Position = "YES" | "NO";
export type Round = 1 | 2 | 3;

// Each round forces a DIFFERENT angle so the 3 rounds progress instead of
// repeating the same point. (#2: distinct lenses.)
export const ROUND_INSTRUCTION: Record<Round, string> = {
  1: "OPENING. Your single strongest, most obvious reason.",
  2: "ESCALATE. A COMPLETELY DIFFERENT angle than round 1 — money, history, human nature, or risk. Do NOT repeat your opening.",
  3: "CLOSING. No new facts. One punchy, confident line that drives your verdict home.",
};

export const ROUND_LABEL: Record<Round, string> = {
  1: "Opening",
  2: "Rebuttal",
  3: "Closing",
};

// Persona per side → real voice/personality contrast even when one model plays
// both sides (single-model mode). (#5: optimist vs skeptic.)
const PERSONA: Record<Position, string> = {
  YES: "You are a breathless techno-optimist: bold and excited (one or two exclamations max) — but you ALWAYS back the hype with one real, concrete reason. Never just cheer.",
  NO: "You are a dry, skeptical researcher: deadpan, unimpressed, precise, allergic to hype. You give one cutting reason, flatly.",
};

/**
 * The system instruction. Kept LEAN on purpose: testing showed small models
 * collapse into meta-commentary under long rule-stacks. Persona + explicit
 * verdict + hard "no invented facts / no dates" guardrails.
 */
function systemInstruction(
  position: Position,
  topic: string,
  round: Round,
): string {
  const verdict = position === "YES" ? "YES" : "NO";
  const opposite = position === "YES" ? "NO" : "YES";

  return [
    PERSONA[position],
    `Debate topic: "${topic}". You say the answer is ${verdict}. Defend ${verdict}, attack ${opposite}. Never agree with ${opposite}, never hedge.`,
    "",
    "Rules:",
    "- Argue from logic and common sense. Do NOT make up statistics, studies, percentages, company names, or breakthroughs that haven't happened — they read as nonsense.",
    `- NEVER write a year, a date, or a number of years (no "2127", no "in 5 years"). Just argue ${verdict} for the question as asked.`,
    "- Stay in character. EXACTLY 2 short sentences. Plain words, no jargon, no padding.",
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
  /** The OPPONENT's last argument. Unused: feeding it hijacks weak models into
   * switching sides. Kept for API compatibility. */
  opponentLast?: string;
  /** This model's OWN previous-round text. Fed back so it makes a DIFFERENT
   * point each round instead of repeating itself (safe — it's the same side,
   * no flip risk). */
  ownLast?: string;
  supportsSystemRole: boolean;
}): ChatMessage[] {
  const { position, topic, round, ownLast, supportsSystemRole } = opts;
  const verdict = position; // "YES" | "NO"
  const system = systemInstruction(position, topic, round);

  const ownExcerpt =
    ownLast && ownLast.trim() ? ownLast.trim().slice(0, 300) : "";
  const userBody =
    ownExcerpt && round > 1
      ? `You ALREADY argued: "${ownExcerpt}". Now make a COMPLETELY DIFFERENT point for ${verdict} — a new angle. Do NOT repeat yourself.`
      : `Argue that the answer is ${verdict}.`;

  if (supportsSystemRole) {
    return [
      { role: "system", content: system },
      { role: "user", content: userBody },
    ];
  }
  return [{ role: "user", content: `${system}\n\n${userBody}` }];
}

/** The committed opener the worker prefills so the model can't flip mid-argument.
 * A clean sentence start ("YES. ") — NOT "YES, because " which forced the model
 * to immediately emit a (often garbled) number/citation. */
export function stancePrefill(position: Position): string {
  return `${position}. `;
}
