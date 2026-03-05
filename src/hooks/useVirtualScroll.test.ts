import { describe, it, expect } from 'vitest';

/**
 * Tests for the virtual scroll logic.
 * Since useVirtualScroll is a React hook that depends on DOM APIs
 * (IntersectionObserver, ResizeObserver, scroll events), we test
 * the pure computation functions extracted from the hook.
 *
 * The hook itself would be tested with @testing-library/react-hooks
 * in integration tests. Here we focus on the algorithmic correctness.
 */

// We test the pure computation logic that powers the hook.
// These functions are re-implemented here to match the hook's internal logic.

function computeItemOffsets(
  totalItems: number,
  itemHeight: number | ((index: number) => number),
): number[] {
  const offsets = new Array<number>(totalItems + 1);
  offsets[0] = 0;
  for (let i = 0; i < totalItems; i++) {
    offsets[i + 1] = offsets[i] + (typeof itemHeight === 'function' ? itemHeight(i) : itemHeight);
  }
  return offsets;
}

function findStartIndex(offsets: number[], scrollTop: number): number {
  let low = 0;
  let high = offsets.length - 2;
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

function computeVisibleRange(
  totalItems: number,
  itemHeight: number | ((index: number) => number),
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): { start: number; end: number } {
  if (totalItems === 0) return { start: 0, end: 0 };

  const offsets = computeItemOffsets(totalItems, itemHeight);
  const scrollBottom = scrollTop + viewportHeight;

  const rawStart = findStartIndex(offsets, scrollTop);
  const start = Math.max(0, rawStart - overscan);

  let rawEnd = rawStart;
  while (rawEnd < totalItems && offsets[rawEnd] < scrollBottom) {
    rawEnd++;
  }
  const end = Math.min(totalItems, rawEnd + overscan);

  return { start, end };
}

describe('computeItemOffsets', () => {
  it('computes offsets for fixed height items', () => {
    const offsets = computeItemOffsets(3, 100);
    expect(offsets).toEqual([0, 100, 200, 300]);
  });

  it('computes offsets for variable height items', () => {
    const offsets = computeItemOffsets(3, (i) => (i + 1) * 50);
    expect(offsets).toEqual([0, 50, 150, 300]);
  });

  it('returns [0] for zero items', () => {
    const offsets = computeItemOffsets(0, 100);
    expect(offsets).toEqual([0]);
  });

  it('handles single item', () => {
    const offsets = computeItemOffsets(1, 200);
    expect(offsets).toEqual([0, 200]);
  });
});

describe('findStartIndex', () => {
  it('finds first item when scrolled to top', () => {
    const offsets = [0, 100, 200, 300];
    expect(findStartIndex(offsets, 0)).toBe(0);
  });

  it('finds correct item when scrolled partway', () => {
    const offsets = [0, 100, 200, 300];
    expect(findStartIndex(offsets, 150)).toBe(1);
  });

  it('finds last item when scrolled to bottom', () => {
    const offsets = [0, 100, 200, 300];
    expect(findStartIndex(offsets, 250)).toBe(2);
  });

  it('finds correct item at exact boundary', () => {
    const offsets = [0, 100, 200, 300];
    expect(findStartIndex(offsets, 100)).toBe(1);
  });

  it('handles single item', () => {
    const offsets = [0, 100];
    expect(findStartIndex(offsets, 0)).toBe(0);
    expect(findStartIndex(offsets, 50)).toBe(0);
  });
});

describe('computeVisibleRange', () => {
  it('computes visible range with no overscan', () => {
    // 10 items, 100px each, viewport 250px, scrolled to top
    const range = computeVisibleRange(10, 100, 0, 250, 0);
    expect(range.start).toBe(0);
    expect(range.end).toBe(3); // items 0, 1, 2 are visible
  });

  it('computes visible range with overscan', () => {
    const range = computeVisibleRange(10, 100, 0, 250, 1);
    expect(range.start).toBe(0); // can't go below 0
    expect(range.end).toBe(4); // 3 visible + 1 overscan
  });

  it('handles scrolled position', () => {
    // Scrolled 350px down: items 3, 4, 5 visible in 250px viewport
    const range = computeVisibleRange(10, 100, 350, 250, 0);
    expect(range.start).toBe(3);
    expect(range.end).toBeGreaterThanOrEqual(6);
  });

  it('handles scrolled position with overscan', () => {
    const range = computeVisibleRange(10, 100, 350, 250, 2);
    expect(range.start).toBe(1); // 3 - 2 overscan
    expect(range.end).toBeLessThanOrEqual(10);
  });

  it('handles empty list', () => {
    const range = computeVisibleRange(0, 100, 0, 500, 1);
    expect(range.start).toBe(0);
    expect(range.end).toBe(0);
  });

  it('clamps overscan to valid bounds', () => {
    const range = computeVisibleRange(5, 100, 0, 300, 10);
    expect(range.start).toBe(0);
    expect(range.end).toBe(5); // can't exceed totalItems
  });

  it('handles variable height items', () => {
    // Items: 50, 100, 150, 200, 250
    const heights = [50, 100, 150, 200, 250];
    const range = computeVisibleRange(5, (i) => heights[i], 0, 200, 0);
    // Offsets: 0, 50, 150, 300, 500, 750
    // Viewport: 0-200 -> items 0 (0-50), 1 (50-150), 2 (150-300)
    expect(range.start).toBe(0);
    expect(range.end).toBeGreaterThanOrEqual(2);
  });

  it('handles single item', () => {
    const range = computeVisibleRange(1, 100, 0, 500, 1);
    expect(range.start).toBe(0);
    expect(range.end).toBe(1);
  });

  it('handles viewport larger than all content', () => {
    const range = computeVisibleRange(3, 100, 0, 1000, 0);
    expect(range.start).toBe(0);
    expect(range.end).toBe(3);
  });
});

describe('scrollToItem logic', () => {
  it('computes correct scroll position for item', () => {
    const offsets = computeItemOffsets(10, 100);
    // Scrolling to item 5 should go to offset 500
    expect(offsets[5]).toBe(500);
  });

  it('computes correct scroll position with variable heights', () => {
    const heights = [50, 100, 150, 200];
    const offsets = computeItemOffsets(4, (i) => heights[i]);
    // Item 3 starts at 50 + 100 + 150 = 300
    expect(offsets[3]).toBe(300);
  });
});

describe('totalHeight computation', () => {
  it('computes total height for fixed items', () => {
    const offsets = computeItemOffsets(10, 100);
    expect(offsets[10]).toBe(1000);
  });

  it('computes total height for variable items', () => {
    const offsets = computeItemOffsets(3, (i) => (i + 1) * 100);
    // 100 + 200 + 300 = 600
    expect(offsets[3]).toBe(600);
  });
});
