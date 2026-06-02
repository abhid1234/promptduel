const MONTH =
  "January|February|March|April|May|June|July|August|September|October|November|December";

/**
 * Clean up small-model output for display (applied to the whole accumulated
 * string each render, so it stays clean even mid-stream):
 * - cut off any leaked next-round header the model spills ("Round 3", "Escalation"…)
 * - strip HTML tags / markdown the model emits (<b>, **bold**, ### headers, > quotes)
 * - scrub invented years, dates, and durations the prompt told it not to write
 *   (keeps 2000-2099 like a topic's "2027"; removes 2127, 22048, "in 7 years", …)
 */
export function cleanArgument(text: string): string {
  let t = text;
  const leak = t.match(
    /\n+\s*(?:[-—]+\s*)?(?:round\s*\d|opening|rebuttal|closing|escalat)/i,
  );
  if (leak && leak.index !== undefined) t = t.slice(0, leak.index);
  t = t
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[`*_]/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(
      new RegExp(
        `\\b(?:by|on|in|around|before|after|until)\\s+(?:the\\s+)?(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?(?:of\\s+)?(?:${MONTH})\\w*,?\\s*\\d{0,4}`,
        "gi",
      ),
      "",
    )
    .replace(new RegExp(`\\b(?:${MONTH})\\w*,?\\s*\\d{2,4}`, "gi"), "")
    .replace(
      /\b(?:in|within|over|after|for|by|next)?\s*\d{1,3}(?:[-\s](?:to|or|–)[-\s]?\d{1,3})?\s+(?:years?|months?|decades?|weeks?)\b/gi,
      "",
    )
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\b(?:2[1-9]\d{2}|[3-9]\d{3})\b/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1");
  return t;
}
