export type TextLayerItem = {
  str: string;
  x: number; // normalized [0,1]
  y: number; // normalized [0,1]
  width: number; // normalized
  height: number; // normalized
  fontHeight: number; // actual font size in PDF units
};

/**
 * Extract text items from a PDF page and normalize their positions to [0,1] coordinates.
 * Works with pdfjs-dist page.getTextContent() result.
 */
export function normalizeTextItems(
  items: Array<{ str: string; transform: number[]; width?: number; height?: number }>,
  viewportWidth: number,
  viewportHeight: number,
): TextLayerItem[] {
  return items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => {
      // transform is [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontSize = Math.abs(item.transform[3]);

      // Convert PDF coords (origin bottom-left) to normalized [0,1] (origin top-left)
      const x = tx / viewportWidth;
      const yBottom = ty / viewportHeight;
      const height = fontSize / viewportHeight;
      const y = 1 - yBottom - height; // flip Y, position at top of text
      const width = (item.width ?? item.str.length * fontSize * 0.5) / viewportWidth;

      return { str: item.str, x, y, width, height, fontHeight: fontSize };
    });
}

/**
 * Build CSS styles for a text layer span element.
 * Returns inline styles that position the span over the rendered PDF canvas.
 */
export function textItemToStyle(
  item: TextLayerItem,
  containerWidth: number,
  containerHeight: number,
): Record<string, string> {
  return {
    position: 'absolute',
    left: `${item.x * containerWidth}px`,
    top: `${item.y * containerHeight}px`,
    width: `${item.width * containerWidth}px`,
    height: `${item.height * containerHeight}px`,
    fontSize: `${item.height * containerHeight}px`,
    lineHeight: '1',
    color: 'transparent',
    userSelect: 'text',
    whiteSpace: 'pre',
  };
}
