import { describe, it, expect } from 'vitest';
import { computeHyperlinkRect, isHyperlinkDraft } from './hyperlinkTool';

describe('computeHyperlinkRect', () => {
  it('computes correct rect for normal start/end', () => {
    const result = computeHyperlinkRect({ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.5 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.width).toBeCloseTo(0.3);
    expect(result.height).toBeCloseTo(0.3);
  });

  it('handles reversed start/end (drag right-to-left)', () => {
    const result = computeHyperlinkRect({ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.2 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.width).toBeCloseTo(0.4);
    expect(result.height).toBeCloseTo(0.3);
  });

  it('handles zero-size rect', () => {
    const result = computeHyperlinkRect({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 });
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe('isHyperlinkDraft', () => {
  it('returns true for valid hyperlink draft', () => {
    expect(
      isHyperlinkDraft({
        toolType: 'hyperlink',
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
        targetPage: 1,
        label: 'test',
      }),
    ).toBe(true);
  });

  it('returns false for null', () => {
    expect(isHyperlinkDraft(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isHyperlinkDraft('string')).toBe(false);
  });

  it('returns false for wrong toolType', () => {
    expect(isHyperlinkDraft({ toolType: 'pen' })).toBe(false);
  });
});
