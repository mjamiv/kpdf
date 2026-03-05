import { describe, it, expect } from 'vitest';
import { clamp01, randomId, normalizeRect, nextZIndex, sortedAnnotations, pointsBoundingBox } from './utils';
import type { Annotation, Point } from '../types';

describe('utils', () => {
  describe('clamp01', () => {
    it('clamps values to [0, 1]', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(1)).toBe(1);
      expect(clamp01(1.5)).toBe(1);
    });
  });

  describe('randomId', () => {
    it('returns a non-empty string', () => {
      const id = randomId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => randomId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('normalizeRect', () => {
    it('normalizes inverted start/end', () => {
      const result = normalizeRect({ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.3 });
      expect(result.x).toBeCloseTo(0.2);
      expect(result.y).toBeCloseTo(0.3);
      expect(result.width).toBeCloseTo(0.3);
      expect(result.height).toBeCloseTo(0.2);
    });

    it('handles normal start/end', () => {
      const result = normalizeRect({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.6 });
      expect(result.x).toBeCloseTo(0.1);
      expect(result.y).toBeCloseTo(0.1);
      expect(result.width).toBeCloseTo(0.4);
      expect(result.height).toBeCloseTo(0.5);
    });
  });

  describe('nextZIndex', () => {
    it('returns 1 for empty array', () => {
      expect(nextZIndex([])).toBe(1);
    });

    it('returns max zIndex + 1', () => {
      const anns = [{ zIndex: 3 }, { zIndex: 7 }, { zIndex: 5 }] as Annotation[];
      expect(nextZIndex(anns)).toBe(8);
    });
  });

  describe('sortedAnnotations', () => {
    it('sorts by zIndex ascending', () => {
      const anns = [
        { id: 'c', zIndex: 3 },
        { id: 'a', zIndex: 1 },
        { id: 'b', zIndex: 2 },
      ] as Annotation[];
      const sorted = sortedAnnotations(anns);
      expect(sorted.map(a => a.id)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate original array', () => {
      const anns = [{ id: 'b', zIndex: 2 }, { id: 'a', zIndex: 1 }] as Annotation[];
      sortedAnnotations(anns);
      expect(anns[0].id).toBe('b');
    });
  });

  describe('pointsBoundingBox', () => {
    it('computes bounding box of points', () => {
      const points: Point[] = [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.8 },
        { x: 0.3, y: 0.1 },
      ];
      const bb = pointsBoundingBox(points);
      expect(bb.minX).toBeCloseTo(0.1);
      expect(bb.minY).toBeCloseTo(0.1);
      expect(bb.maxX).toBeCloseTo(0.5);
      expect(bb.maxY).toBeCloseTo(0.8);
    });
  });
});
