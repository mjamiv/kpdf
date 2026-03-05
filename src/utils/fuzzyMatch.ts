/**
 * Fuzzy matching utility for command palette search.
 *
 * Integration: Used by CommandPalette.tsx to filter and rank commands.
 * No App.tsx modifications needed — CommandPalette consumes this internally.
 */

export type FuzzyMatchResult = {
  match: boolean;
  score: number;
  ranges: Array<[number, number]>;
};

/**
 * Performs sequential character matching with gap penalty scoring.
 *
 * Algorithm:
 * - Each query character must appear in order in the text
 * - Consecutive matches score higher (bonus for adjacency)
 * - Matches at word boundaries score higher
 * - Gaps between matches incur a penalty
 *
 * @param query - The search query string
 * @param text - The text to match against
 * @returns FuzzyMatchResult with match status, score, and highlight ranges
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatchResult {
  if (query.length === 0) {
    return { match: true, score: 0, ranges: [] };
  }

  if (text.length === 0) {
    return { match: false, score: 0, ranges: [] };
  }

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Check if all characters exist in order
  let qi = 0;
  const matchIndices: number[] = [];

  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      matchIndices.push(ti);
      qi++;
    }
  }

  if (qi < lowerQuery.length) {
    return { match: false, score: 0, ranges: [] };
  }

  // Compute score
  let score = 0;
  const CONSECUTIVE_BONUS = 10;
  const BOUNDARY_BONUS = 8;
  const CASE_MATCH_BONUS = 2;
  const GAP_PENALTY = -1;
  const FIRST_CHAR_BONUS = 15;

  for (let i = 0; i < matchIndices.length; i++) {
    const idx = matchIndices[i];

    // Base score for a match
    score += 5;

    // Bonus for matching the first character
    if (idx === 0) {
      score += FIRST_CHAR_BONUS;
    }

    // Bonus for consecutive matches
    if (i > 0 && matchIndices[i] === matchIndices[i - 1] + 1) {
      score += CONSECUTIVE_BONUS;
    }

    // Bonus for word boundary matches (after space, hyphen, underscore, or camelCase)
    if (idx > 0) {
      const prevChar = text[idx - 1];
      if (prevChar === ' ' || prevChar === '-' || prevChar === '_') {
        score += BOUNDARY_BONUS;
      } else if (
        text[idx] === text[idx].toUpperCase() &&
        text[idx - 1] === text[idx - 1].toLowerCase()
      ) {
        score += BOUNDARY_BONUS;
      }
    }

    // Bonus for exact case match
    if (query[i] === text[idx]) {
      score += CASE_MATCH_BONUS;
    }

    // Gap penalty
    if (i > 0) {
      const gap = matchIndices[i] - matchIndices[i - 1] - 1;
      score += gap * GAP_PENALTY;
    }
  }

  // Build contiguous ranges for highlighting
  const ranges = buildRanges(matchIndices);

  return { match: true, score, ranges };
}

function buildRanges(indices: number[]): Array<[number, number]> {
  if (indices.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  let start = indices[0];
  let end = indices[0];

  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === end + 1) {
      end = indices[i];
    } else {
      ranges.push([start, end + 1]);
      start = indices[i];
      end = indices[i];
    }
  }
  ranges.push([start, end + 1]);

  return ranges;
}
