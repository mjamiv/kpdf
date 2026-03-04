import type { TextLayerItem } from './textLayer';
import type { Point } from '../types';

/**
 * Find text items that overlap with a rectangular selection region.
 */
export function findTextItemsInRect(
  items: TextLayerItem[],
  start: Point,
  end: Point,
): TextLayerItem[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  return items.filter((item) => {
    const itemRight = item.x + item.width;
    const itemBottom = item.y + item.height;
    return item.x < maxX && itemRight > minX && item.y < maxY && itemBottom > minY;
  });
}

/**
 * Group text items by line (approximate y-position) and compute
 * highlight rectangles that span each line of selected text.
 */
export function computeHighlightRects(
  selectedItems: TextLayerItem[],
  lineThreshold: number = 0.005,
): Array<{ x: number; y: number; width: number; height: number }> {
  if (selectedItems.length === 0) return [];

  // Sort by y, then x
  const sorted = [...selectedItems].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > lineThreshold) return dy;
    return a.x - b.x;
  });

  // Group into lines
  const lines: TextLayerItem[][] = [];
  let currentLine: TextLayerItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentLine[0].y) <= lineThreshold) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine);
      currentLine = [sorted[i]];
    }
  }
  lines.push(currentLine);

  // For each line, compute bounding rect
  return lines.map((lineItems) => {
    const minX = Math.min(...lineItems.map((item) => item.x));
    const maxX = Math.max(...lineItems.map((item) => item.x + item.width));
    const minY = Math.min(...lineItems.map((item) => item.y));
    const maxY = Math.max(...lineItems.map((item) => item.y + item.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });
}

/**
 * Check if a text layer has meaningful content (non-scanned PDF).
 */
export function hasTextContent(items: TextLayerItem[]): boolean {
  return items.length > 0;
}
