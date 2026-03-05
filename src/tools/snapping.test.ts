import { describe, it, expect } from 'vitest';
import { computeSnap, constrainTo45 } from './snapping';
import type { Annotation, BaseAnnotation } from '../types';

const base: BaseAnnotation = {
  id: 'test',
  zIndex: 0,
  color: '#000',
  author: 'tester',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  locked: false,
};

function makeRect(id: string, x: number, y: number, w: number, h: number): Annotation {
  return {
    ...base,
    id,
    type: 'rectangle' as const,
    x,
    y,
    width: w,
    height: h,
    thickness: 0.002,
  };
}

describe('computeSnap', () => {
  it('snaps to left edge of nearby annotation', () => {
    const rect = makeRect('r1', 0.5, 0.2, 0.1, 0.1);
    const result = computeSnap({ x: 0.505, y: 0.0 }, new Set(), [rect], 0.01);
    expect(result.snappedPoint.x).toBe(0.5);
    expect(result.guides.some((g) => g.axis === 'x' && g.position === 0.5)).toBe(true);
  });

  it('snaps to center of nearby annotation', () => {
    const rect = makeRect('r1', 0.4, 0.3, 0.2, 0.1);
    // centerX = 0.5, centerY = 0.35
    const result = computeSnap({ x: 0.502, y: 0.352 }, new Set(), [rect], 0.01);
    expect(result.snappedPoint.x).toBe(0.5);
    expect(result.snappedPoint.y).toBe(0.35);
  });

  it('does not snap when beyond tolerance', () => {
    const rect = makeRect('r1', 0.5, 0.2, 0.1, 0.1);
    const result = computeSnap({ x: 0.52, y: 0.0 }, new Set(), [rect], 0.01);
    expect(result.snappedPoint.x).toBe(0.52);
    expect(result.guides.length).toBe(0);
  });

  it('snaps both X and Y simultaneously', () => {
    const rect = makeRect('r1', 0.3, 0.4, 0.2, 0.1);
    // left=0.3, top=0.4
    const result = computeSnap({ x: 0.302, y: 0.402 }, new Set(), [rect], 0.01);
    expect(result.snappedPoint.x).toBe(0.3);
    expect(result.snappedPoint.y).toBe(0.4);
    expect(result.guides.some((g) => g.axis === 'x')).toBe(true);
    expect(result.guides.some((g) => g.axis === 'y')).toBe(true);
  });

  it('excludes moving annotation from snap targets', () => {
    const rect = makeRect('r1', 0.5, 0.2, 0.1, 0.1);
    const result = computeSnap({ x: 0.505, y: 0.0 }, new Set(['r1']), [rect], 0.01);
    expect(result.snappedPoint.x).toBe(0.505);
    expect(result.guides.length).toBe(0);
  });

  it('returns original point with empty annotations', () => {
    const result = computeSnap({ x: 0.5, y: 0.3 }, new Set(), [], 0.01);
    expect(result.snappedPoint).toEqual({ x: 0.5, y: 0.3 });
    expect(result.guides.length).toBe(0);
  });
});

describe('constrainTo45', () => {
  const start = { x: 0.5, y: 0.5 };

  it('snaps to 0 degrees (right)', () => {
    const result = constrainTo45(start, { x: 0.7, y: 0.51 });
    expect(result.x).toBeCloseTo(0.7, 1);
    expect(result.y).toBeCloseTo(0.5, 1);
  });

  it('snaps to 90 degrees (down)', () => {
    const result = constrainTo45(start, { x: 0.51, y: 0.7 });
    expect(result.x).toBeCloseTo(0.5, 1);
    expect(result.y).toBeCloseTo(0.7, 1);
  });

  it('snaps to 45 degrees', () => {
    const result = constrainTo45(start, { x: 0.7, y: 0.71 });
    const dist = Math.sqrt(0.2 * 0.2 + 0.21 * 0.21);
    expect(result.x - start.x).toBeCloseTo(result.y - start.y, 5);
    expect(Math.sqrt((result.x - start.x) ** 2 + (result.y - start.y) ** 2)).toBeCloseTo(dist, 5);
  });

  it('snaps to 180 degrees (left)', () => {
    const result = constrainTo45(start, { x: 0.3, y: 0.49 });
    expect(result.x).toBeCloseTo(0.3, 1);
    expect(result.y).toBeCloseTo(0.5, 1);
  });

  it('returns start point when end equals start', () => {
    const result = constrainTo45(start, start);
    expect(result.x).toBeCloseTo(start.x, 5);
    expect(result.y).toBeCloseTo(start.y, 5);
  });
});
