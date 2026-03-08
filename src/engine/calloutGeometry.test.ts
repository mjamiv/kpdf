import { describe, it, expect } from 'vitest';
import { computeBoxEdgeAnchor, ensureKnee } from './calloutGeometry';

describe('computeBoxEdgeAnchor', () => {
  const box = { x: 0.3, y: 0.3, width: 0.2, height: 0.1 };

  it('returns left edge when point is to the left', () => {
    const result = computeBoxEdgeAnchor({ x: 0.1, y: 0.35 }, box);
    expect(result.x).toBeCloseTo(0.3);
    expect(result.y).toBeCloseTo(0.35);
  });

  it('returns right edge when point is to the right', () => {
    const result = computeBoxEdgeAnchor({ x: 0.7, y: 0.35 }, box);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.35);
  });

  it('returns top edge when point is above', () => {
    const result = computeBoxEdgeAnchor({ x: 0.4, y: 0.1 }, box);
    expect(result.y).toBeCloseTo(0.3);
    expect(result.x).toBeCloseTo(0.4);
  });

  it('returns bottom edge when point is below', () => {
    const result = computeBoxEdgeAnchor({ x: 0.4, y: 0.6 }, box);
    expect(result.y).toBeCloseTo(0.4);
    expect(result.x).toBeCloseTo(0.4);
  });

  it('handles corner case (diagonal)', () => {
    const result = computeBoxEdgeAnchor({ x: 0.1, y: 0.1 }, box);
    // Should land on an edge of the box
    const onLeft = Math.abs(result.x - 0.3) < 1e-6;
    const onTop = Math.abs(result.y - 0.3) < 1e-6;
    expect(onLeft || onTop).toBe(true);
  });

  it('handles degenerate case (point at box center)', () => {
    const result = computeBoxEdgeAnchor({ x: 0.4, y: 0.35 }, box);
    // Should return left edge fallback
    expect(result.x).toBeCloseTo(0.3);
  });
});

describe('ensureKnee', () => {
  const box = { x: 0.3, y: 0.3, width: 0.2, height: 0.1 };
  const anchor = { x: 0.1, y: 0.15 };

  it('returns existing knee if provided', () => {
    const knee = { x: 0.2, y: 0.25 };
    expect(ensureKnee(anchor, box, knee)).toBe(knee);
  });

  it('auto-generates knee when undefined', () => {
    const knee = ensureKnee(anchor, box);
    expect(knee).toBeDefined();
    expect(typeof knee.x).toBe('number');
    expect(typeof knee.y).toBe('number');
    // Auto-knee should share y with anchor for L-shape
    expect(knee.y).toBeCloseTo(anchor.y);
  });
});
