/**
 * Sheet reference detection for AEC documents.
 *
 * Detects common AEC sheet reference patterns in text content extracted from PDFs.
 * Patterns recognized:
 *   - "SEE DETAIL A/S-201"
 *   - "SHEET S-201", "SHEET A-101"
 *   - "REFER TO A-101"
 *   - "SEE SHEET A-101"
 *   - "SEE A-101"
 *   - "DETAIL 3/A-201"
 *   - Standalone sheet IDs like "A-101", "S-201", "M-001", "E-100", "P-300"
 *
 * AEC sheet naming convention: A single uppercase letter prefix (discipline code)
 * followed by a hyphen and a numeric identifier (typically 3+ digits).
 *
 * Discipline codes:
 *   A = Architectural, S = Structural, M = Mechanical, E = Electrical,
 *   P = Plumbing, C = Civil, L = Landscape, G = General, etc.
 */

export type SheetReference = {
  /** The full matched text (e.g., "SEE SHEET A-101") */
  text: string;
  /** The target sheet identifier (e.g., "A-101") */
  targetSheet: string;
  /** Position metadata */
  position: {
    pageIndex: number;
  };
};

/**
 * Common AEC sheet identifier pattern: letter prefix + hyphen + digits.
 * Examples: A-101, S-201, M-001, E-100, P-300, C-001, L-100
 */
const SHEET_ID_PATTERN = '[A-Z]-\\d{2,}';

/**
 * Patterns that reference another sheet, ordered by specificity.
 * Each pattern captures the full reference text and the sheet ID.
 */
const REFERENCE_PATTERNS: RegExp[] = [
  // "SEE DETAIL 3/A-201" or "SEE DETAIL A/S-201"
  new RegExp(`(SEE\\s+DETAIL\\s+[A-Z0-9]+\\/(${SHEET_ID_PATTERN}))`, 'gi'),
  // "DETAIL 3/A-201"
  new RegExp(`(DETAIL\\s+[A-Z0-9]+\\/(${SHEET_ID_PATTERN}))`, 'gi'),
  // "SEE SHEET A-101"
  new RegExp(`(SEE\\s+SHEET\\s+(${SHEET_ID_PATTERN}))`, 'gi'),
  // "REFER TO A-101"
  new RegExp(`(REFER\\s+TO\\s+(${SHEET_ID_PATTERN}))`, 'gi'),
  // "SHEET A-101"
  new RegExp(`(SHEET\\s+(${SHEET_ID_PATTERN}))`, 'gi'),
  // "SEE A-101"
  new RegExp(`(SEE\\s+(${SHEET_ID_PATTERN}))`, 'gi'),
  // Standalone sheet IDs (only when preceded by whitespace/start and followed by whitespace/end)
  new RegExp(`(?:^|\\s)(${SHEET_ID_PATTERN})(?:\\s|$|[,;.)])`, 'gi'),
];

/**
 * Detect sheet references in text content from a PDF page.
 *
 * @param textContent - The raw text content from the PDF page.
 * @param pageIndex - The 0-based page index this text was extracted from.
 * @returns Array of detected sheet references.
 */
export function detectSheetReferences(textContent: string, pageIndex: number = 0): SheetReference[] {
  const results: SheetReference[] = [];
  const seen = new Set<string>();

  for (const pattern of REFERENCE_PATTERNS) {
    // Reset lastIndex for each pattern since they have the 'g' flag
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(textContent)) !== null) {
      // For standalone pattern (last pattern), group 1 is the sheet ID itself
      // For other patterns, group 1 is the full text, group 2 is the sheet ID
      const fullText = match[1].trim();
      const sheetId = (match[2] ?? match[1]).trim().toUpperCase();

      // Deduplicate by sheet ID within the same page
      const key = `${pageIndex}:${sheetId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        text: fullText,
        targetSheet: sheetId,
        position: { pageIndex },
      });
    }
  }

  return results;
}

/**
 * Extract the sheet identifier from a page's text content.
 * Looks for title block patterns like "SHEET: A-101" or "DRAWING NO: A-101"
 * typically found at the bottom-right of AEC drawings.
 *
 * @param textContent - The raw text from a PDF page.
 * @returns The detected sheet number, or null if not found.
 */
export function extractSheetNumber(textContent: string): string | null {
  const titleBlockPatterns = [
    // "SHEET: A-101" or "SHEET NO: A-101" or "SHEET NO. A-101"
    new RegExp(`SHEET\\s*(?:NO\\.?\\s*)?:?\\s*(${SHEET_ID_PATTERN})`, 'i'),
    // "DRAWING NO: A-101" or "DWG NO: A-101"
    new RegExp(`(?:DRAWING|DWG)\\s*(?:NO\\.?\\s*)?:?\\s*(${SHEET_ID_PATTERN})`, 'i'),
    // Just find any sheet ID as a fallback
    new RegExp(`(${SHEET_ID_PATTERN})`, 'i'),
  ];

  for (const pattern of titleBlockPatterns) {
    const match = pattern.exec(textContent);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}
