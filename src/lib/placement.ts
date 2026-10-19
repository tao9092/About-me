// Reads a competition's free-text placement ("Rank: 81 out of 545", "28th/105th",
// "1st place out of 30", "6th", "第3名/50队", "Rank: 27 out of 723 (All Solved)")
// into numbers: the rank, the size of the field when given, and the share of
// the field at or above it. A lone number counts as a rank only when it reads
// like one ("6th", "Rank 6", "第6名"), so "Top 10" or "Finalist (12 teams)"
// aren't mistaken for tenth or twelfth.
export type Placement = { rank: number | null; field: number | null; share: number | null; note: string | null };

export function readPlacement(text: unknown): Placement {
  const value = typeof text === "string" ? text.trim() : "";
  const note = value.match(/\(([^)]+)\)/)?.[1] ?? null;
  const bare = value.replace(/\([^)]*\)/g, " ");
  const pair = bare.match(/(\d+)(?:st|nd|rd|th)?\D{0,12}?(?:\/|out of|of)\s*(\d+)/i);
  if (pair) {
    const rank = Number(pair[1]);
    const field = Number(pair[2]);
    return { rank, field, share: field > 0 && rank >= 1 && rank <= field ? rank / field : null, note };
  }
  const single = bare.match(/(\d+)\s*(?:st|nd|rd|th|名)/i) ?? bare.match(/(?:rank|place|no\.?|#)\s*:?\s*(\d+)/i);
  return { rank: single ? Number(single[1]) : null, field: null, share: null, note };
}

/** "Top 3.7%" style, from a share of the field. */
export const topPercent = (share: number) => `${share < 0.1 ? (share * 100).toFixed(1) : Math.round(share * 100)}%`;
