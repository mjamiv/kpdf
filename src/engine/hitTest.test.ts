import { describe, it, expect } from 'vitest';
import {
  distanceToLineSegment,
  pointInPolygon,
  boundingBox,
  pointInAnnotation,
  hitTestAnnotations,
} from './hitTest.ts';
import type { BaseAnnotation, PenAnnotation, RectAnnotation, TextAnnotation, PolygonAnnotation } from '../types.ts';

const base: BaseAnnotation = {
  id: 'test',
  zIndex: 0,
  color: '#000',
  author: 'tester',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  locked: false,
};

function makeBase(overrides?: Partial<BaseAnnotation>): BaseAnnotation {
  return { ...base, ...overrides };
}

describe('distanceToLineSegment', () => {
  it('perpendicular case', () => {
    const d = distanceToLineSegment({ x: 0.5, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toBeCloseTo(1, 5);
  });

  it('endpoint case (closest to start)', () => {
    const d = distanceToLineSegment({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toBeCloseTo(1, 5);
  });

  it('collinear case (point on segment)', () => {
    const d = distanceToLineSegment({ x: 0.5, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toBeCloseTo(0, 5);
  });
});

describe('pointInPolygon', () => {
  const triangle = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0.5, y: 1 },
  ];

  it('inside triangle', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.3 }, triangle)).toBe(true);
  });

  it('outside triangle', () => {
    expect(pointInPolygon({ x: 2, y: 2 }, triangle)).toBe(false);
  });

  it('on edge returns consistent result', () => {
    const result = pointInPolygon({ x: 0.5, y: 0 }, triangle);
    expect(typeof result).toBe('boolean');
  });
});

describe('boundingBox', () => {
  it('PenAnnotation with multiple points', () => {
    const pen: PenAnnotation = {
      ...makeBase(),
      type: 'pen',
      points: [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.8 }, { x: 0.3, y: 0.1 }],
      thickness: 0.002,
    };
    const bb = boundingBox(pen);
    expect(bb.x).toBeCloseTo(0.1);
    expect(bb.y).toBeCloseTo(0.1);
    expect(bb.width).toBeCloseTo(0.4);
    expect(bb.height).toBeCloseTo(0.7);
  });

  it('RectAnnotation direct passthrough', () => {
    const rect: RectAnnotation = {
      ...makeBase(),
      type: 'rectangle',
      x: 0.1, y: 0.2, width: 0.3, height: 0.4,
      thickness: 0.002,
    };
    const bb = boundingBox(rect);
    expect(bb).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  });

  it('TextAnnotation estimated', () => {
    const text: TextAnnotation = {
      ...makeBase(),
      type: 'text',
      x: 0.1, y: 0.5,
      text: 'Hello',
      fontSize: 0.02,
    };
    const bb = boundingBox(text);
    expect(bb.x).toBeCloseTo(0.1);
    expect(bb.y).toBeCloseTo(0.5 - 0.02 * 1.2);
    expect(bb.width).toBeCloseTo(5 * 0.02 * 0.6);
    expect(bb.height).toBeCloseTo(0.02 * 1.2);
  });
});

describe('pointInAnnotation', () => {
  it('point inside rect annotation', () => {
    const rect: RectAnnotation = {
      ...makeBase(),
      type: 'rectangle',
      x: 0.2, y: 0.2, width: 0.3, height: 0.3,
      thickness: 0.002,
    };
    expect(pointInAnnotation({ x: 0.35, y: 0.35 }, rect)).toBe(true);
  });

  it('point outside rect annotation', () => {
    const rect: RectAnnotation = {
      ...makeBase(),
      type: 'rectangle',
      x: 0.2, y: 0.2, width: 0.3, height: 0.3,
      thickness: 0.002,
    };
    expect(pointInAnnotation({ x: 0.8, y: 0.8 }, rect)).toBe(false);
  });

  it('point near pen line within tolerance', () => {
    const pen: PenAnnotation = {
      ...makeBase(),
      type: 'pen',
      points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
      thickness: 0.002,
    };
    expect(pointInAnnotation({ x: 0.5, y: 0.505 }, pen)).toBe(true);
  });

  it('point far from pen line', () => {
    const pen: PenAnnotation = {
      ...makeBase(),
      type: 'pen',
      points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
      thickness: 0.002,
    };
    expect(pointInAnnotation({ x: 0.5, y: 0.9 }, pen)).toBe(false);
  });

  it('point inside polygon', () => {
    const poly: PolygonAnnotation = {
      ...makeBase(),
      type: 'polygon',
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      closed: true,
      thickness: 0.002,
    };
    expect(pointInAnnotation({ x: 0.5, y: 0.5 }, poly)).toBe(true);
  });
});

describe('hitTestAnnotations', () => {
  it('returns highest z-order hit', () => {
    const low: RectAnnotation = {
      ...makeBase({ id: 'low', zIndex: 1 }),
      type: 'rectangle',
      x: 0.2, y: 0.2, width: 0.3, height: 0.3,
      thickness: 0.002,
    };
    const high: RectAnnotation = {
      ...makeBase({ id: 'high', zIndex: 5 }),
      type: 'rectangle',
      x: 0.2, y: 0.2, width: 0.3, height: 0.3,
      thickness: 0.002,
    };
    const result = hitTestAnnotations({ x: 0.35, y: 0.35 }, [low, high]);
    expect(result?.id).toBe('high');
  });

  it('returns null for miss', () => {
    const rect: RectAnnotation = {
      ...makeBase(),
      type: 'rectangle',
      x: 0.2, y: 0.2, width: 0.1, height: 0.1,
      thickness: 0.002,
    };
    expect(hitTestAnnotations({ x: 0.9, y: 0.9 }, [rect])).toBeNull();
  });
});

describe('edge cases', () => {
  it('empty points array in pen', () => {
    const pen: PenAnnotation = {
      ...makeBase(),
      type: 'pen',
      points: [],
      thickness: 0.002,
    };
    const bb = boundingBox(pen);
    expect(bb).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(pointInAnnotation({ x: 0, y: 0 }, pen)).toBe(false);
  });

  it('zero-size rect', () => {
    const rect: RectAnnotation = {
      ...makeBase(),
      type: 'rectangle',
      x: 0.5, y: 0.5, width: 0, height: 0,
      thickness: 0.002,
    };
    // Point at the rect location should be within tolerance
    expect(pointInAnnotation({ x: 0.5, y: 0.5 }, rect)).toBe(true);
    // Point far away should not
    expect(pointInAnnotation({ x: 0.9, y: 0.9 }, rect)).toBe(false);
  });
});
