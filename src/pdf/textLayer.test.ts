import { describe, it, expect } from 'vitest';
import { normalizeTextItems } from './textLayer';
import { findTextItemsInRect, computeHighlightRects, hasTextContent } from './textHighlight';
import { searchText, searchResultToRect } from './search';

describe('normalizeTextItems', () => {
  it('converts PDF coordinates to normalized [0,1]', () => {
    const items = [
      {
        str: 'Hello',
        transform: [12, 0, 0, 12, 72, 700],
        width: 30,
      },
    ];
    const result = normalizeTextItems(items, 612, 792);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBeCloseTo(72 / 612);
    expect(result[0].width).toBeCloseTo(30 / 612);
    expect(result[0].height).toBeCloseTo(12 / 792);
  });

  it('filters empty strings', () => {
    const items = [
      { str: '', transform: [12, 0, 0, 12, 72, 700], width: 0 },
      { str: '  ', transform: [12, 0, 0, 12, 72, 680], width: 0 },
      { str: 'Hello', transform: [12, 0, 0, 12, 72, 660], width: 30 },
    ];
    const result = normalizeTextItems(items, 612, 792);
    expect(result).toHaveLength(1);
  });
});

describe('findTextItemsInRect', () => {
  const items = [
    { str: 'First', x: 0.1, y: 0.1, width: 0.1, height: 0.02, fontHeight: 12 },
    { str: 'Second', x: 0.3, y: 0.1, width: 0.12, height: 0.02, fontHeight: 12 },
    { str: 'Third', x: 0.1, y: 0.3, width: 0.1, height: 0.02, fontHeight: 12 },
  ];

  it('finds items overlapping selection rect', () => {
    const result = findTextItemsInRect(items, { x: 0.05, y: 0.05 }, { x: 0.25, y: 0.15 });
    expect(result).toHaveLength(1);
    expect(result[0].str).toBe('First');
  });

  it('finds multiple items', () => {
    const result = findTextItemsInRect(items, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(result).toHaveLength(3);
  });

  it('returns empty for no overlap', () => {
    const result = findTextItemsInRect(items, { x: 0.9, y: 0.9 }, { x: 1, y: 1 });
    expect(result).toHaveLength(0);
  });
});

describe('computeHighlightRects', () => {
  it('groups items on same line into one rect', () => {
    const items = [
      { str: 'Hello', x: 0.1, y: 0.1, width: 0.1, height: 0.02, fontHeight: 12 },
      { str: 'World', x: 0.25, y: 0.1, width: 0.1, height: 0.02, fontHeight: 12 },
    ];
    const rects = computeHighlightRects(items);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(0.1);
    expect(rects[0].width).toBeCloseTo(0.25);
  });

  it('creates separate rects for different lines', () => {
    const items = [
      { str: 'Line1', x: 0.1, y: 0.1, width: 0.1, height: 0.02, fontHeight: 12 },
      { str: 'Line2', x: 0.1, y: 0.3, width: 0.1, height: 0.02, fontHeight: 12 },
    ];
    const rects = computeHighlightRects(items);
    expect(rects).toHaveLength(2);
  });

  it('returns empty for no items', () => {
    expect(computeHighlightRects([])).toHaveLength(0);
  });
});

describe('hasTextContent', () => {
  it('returns true when items exist', () => {
    expect(
      hasTextContent([{ str: 'x', x: 0, y: 0, width: 0.1, height: 0.02, fontHeight: 12 }]),
    ).toBe(true);
  });
  it('returns false for empty array', () => {
    expect(hasTextContent([])).toBe(false);
  });
});

describe('searchText', () => {
  const items = [
    { str: 'Hello World', x: 0.1, y: 0.1, width: 0.2, height: 0.02, fontHeight: 12 },
    { str: 'hello again', x: 0.1, y: 0.2, width: 0.2, height: 0.02, fontHeight: 12 },
  ];

  it('finds case-insensitive matches', () => {
    const results = searchText(items, 'hello');
    expect(results).toHaveLength(2);
  });

  it('finds case-sensitive matches', () => {
    const results = searchText(items, 'hello', true);
    expect(results).toHaveLength(1);
    expect(results[0].item.str).toBe('hello again');
  });

  it('returns empty for no matches', () => {
    expect(searchText(items, 'xyz')).toHaveLength(0);
  });

  it('returns empty for empty query', () => {
    expect(searchText(items, '')).toHaveLength(0);
  });
});

describe('searchResultToRect', () => {
  it('computes rect for search result', () => {
    const item = {
      str: 'Hello World',
      x: 0.1,
      y: 0.1,
      width: 0.22,
      height: 0.02,
      fontHeight: 12,
    };
    const rect = searchResultToRect({ item, matchIndex: 6, length: 5 });
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.height).toBeCloseTo(0.02);
    // charWidth = 0.22 / 11 = 0.02
    expect(rect.x).toBeCloseTo(0.1 + 0.02 * 6);
    expect(rect.width).toBeCloseTo(0.02 * 5);
  });
});
