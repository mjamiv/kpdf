import { describe, expect, it } from 'vitest';
import { toLineSegments, toPdfPoint } from './pdfExport';
import { clamp01 } from './engine/utils';

describe('pdf export helpers', () => {
  it('maps normalized points to PDF coordinates', () => {
    const point = toPdfPoint({ x: 0.25, y: 0.25 }, 600, 800);
    expect(point.x).toBe(150);
    expect(point.y).toBe(600);
  });

  it('clamps values to [0,1]', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.2)).toBe(1);
  });

  it('builds non-degenerate line segments', () => {
    const segments = toLineSegments([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0].start).toEqual({ x: 0, y: 0 });
    expect(segments[0].end).toEqual({ x: 0.1, y: 0.1 });
  });
});
