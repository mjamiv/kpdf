/**
 * Hook encapsulating virtual scroll logic for large document rendering.
 *
 * Integration with App.tsx:
 * - Provide a ref to the scroll container, total page count, and a function
 *   that returns the height for each page (based on zoom and page dimensions).
 * - The hook returns the visible range, total height, offset, and a scrollToItem function.
 * - Use visibleRange to determine which pages to render (only render pages in range).
 * - Use totalHeight and offsetTop to position a spacer div that maintains scroll position.
 * - Use scrollToItem to jump to a specific page (e.g., from page navigation or search).
 *
 * Props expected from App.tsx:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { visibleRange, totalHeight, offsetTop, scrollToItem } = useVirtualScroll({
 *     totalItems: pageCount,
 *     itemHeight: (i) => getPageHeight(i + 1) + PAGE_GAP,
 *     containerRef,
 *     overscan: 1,
 *   });
 */

import { useState, useEffect, useCallback, type RefObject } from 'react';

export type UseVirtualScrollOptions = {
  totalItems: number;
  itemHeight: number | ((index: number) => number);
  containerRef: RefObject<HTMLElement | null>;
  overscan?: number;
};

export type VirtualScrollResult = {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetTop: number;
  scrollToItem: (index: number) => void;
};

function getItemHeight(
  itemHeight: number | ((index: number) => number),
  index: number,
): number {
  return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
}

function computeItemOffsets(
  totalItems: number,
  itemHeight: number | ((index: number) => number),
): number[] {
  const offsets = new Array<number>(totalItems + 1);
  offsets[0] = 0;
  for (let i = 0; i < totalItems; i++) {
    offsets[i + 1] = offsets[i] + getItemHeight(itemHeight, i);
  }
  return offsets;
}

function findStartIndex(offsets: number[], scrollTop: number): number {
  // Binary search for the first item whose bottom edge is past scrollTop
  let low = 0;
  let high = offsets.length - 2; // last valid item index
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (offsets[mid + 1] <= scrollTop) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

export function useVirtualScroll(options: UseVirtualScrollOptions): VirtualScrollResult {
  const { totalItems, itemHeight, containerRef, overscan = 1 } = options;

  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.min(totalItems, 3),
  });

  const offsets = computeItemOffsets(totalItems, itemHeight);
  const totalHeight = offsets[totalItems] ?? 0;
  const offsetTop = offsets[visibleRange.start] ?? 0;

  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container || totalItems === 0) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const scrollBottom = scrollTop + viewportHeight;

    const currentOffsets = computeItemOffsets(totalItems, itemHeight);

    const rawStart = findStartIndex(currentOffsets, scrollTop);
    const start = Math.max(0, rawStart - overscan);

    let rawEnd = rawStart;
    while (rawEnd < totalItems && currentOffsets[rawEnd] < scrollBottom) {
      rawEnd++;
    }
    const end = Math.min(totalItems, rawEnd + overscan);

    setVisibleRange((prev) => {
      if (prev.start === start && prev.end === end) return prev;
      return { start, end };
    });
  }, [containerRef, totalItems, itemHeight, overscan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    calculateVisibleRange();

    const handleScroll = () => {
      calculateVisibleRange();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      calculateVisibleRange();
    });
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [containerRef, calculateVisibleRange]);

  const scrollToItem = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container || index < 0 || index >= totalItems) return;

      const currentOffsets = computeItemOffsets(totalItems, itemHeight);
      const targetOffset = currentOffsets[index];

      container.scrollTo({
        top: targetOffset,
        behavior: 'smooth',
      });
    },
    [containerRef, totalItems, itemHeight],
  );

  return {
    visibleRange,
    totalHeight,
    offsetTop,
    scrollToItem,
  };
}
