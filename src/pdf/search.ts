import type { TextLayerItem } from './textLayer';

export type SearchResult = {
  item: TextLayerItem;
  matchIndex: number; // index within the item's string
  length: number;
};

/**
 * Search through text layer items for a query string.
 */
export function searchText(
  items: TextLayerItem[],
  query: string,
  caseSensitive: boolean = false,
): SearchResult[] {
  if (!query || query.length === 0) return [];

  const results: SearchResult[] = [];
  const searchQuery = caseSensitive ? query : query.toLowerCase();

  for (const item of items) {
    const itemStr = caseSensitive ? item.str : item.str.toLowerCase();
    let startIndex = 0;

    while (true) {
      const idx = itemStr.indexOf(searchQuery, startIndex);
      if (idx === -1) break;
      results.push({ item, matchIndex: idx, length: query.length });
      startIndex = idx + 1;
    }
  }

  return results;
}

/**
 * Compute highlight rectangles for search results (approximate character positions).
 */
export function searchResultToRect(result: SearchResult): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const charWidth = result.item.width / Math.max(result.item.str.length, 1);
  return {
    x: result.item.x + charWidth * result.matchIndex,
    y: result.item.y,
    width: charWidth * result.length,
    height: result.item.height,
  };
}
