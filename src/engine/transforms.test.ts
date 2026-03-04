import { describe, it, expect } from 'vitest';
import { moveAnnotation, resizeAnnotation, bringToFront, sendToBack, bringForward, sendBackward, rotateAnnotation } from './transforms';
import type { Annotation, PenAnnotation, RectAnnotation, ArrowAnnotation, BaseAnnotation } from '../types';

const base: BaseAnnotation = {
  id: 'a1',
  zIndex: 1,
  color: '#ff0000',
  author: 'test',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  locked: false,
};

function makePen(overrides?: Partial<PenAnnotation>): PenAnnotation {
  return { ...base, type: 'pen', points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }], thickness: 2, ...overrides };
}

function makeRect(overrides?: Partial<RectAnnotation>): RectAnnotation {
  return { ...base, type: 'rectangle', x: 0.2, y: 0.3, width: 0.4, height: 0.3, thickness: 1, ...overrides };
}

function makeArrow(overrides?: Partial<ArrowAnnotation>): ArrowAnnotation {
  return { ...base, type: 'arrow', start: { x: 0.1, y: 0.2 }, end: { x: 0.5, y: 0.6 }, thickness: 2, headSize: 10, ...overrides };
}

describe('moveAnnotation', () => {
  it('shifts all pen points correctly', () => {
    const pen = makePen();
    const moved = moveAnnotation(pen, 0.1, 0.05) as PenAnnotation;
    expect(moved.points[0]).toEqual({ x: 0.2, y: 0.25 });
    expect(moved.points[1]).toEqual({ x: 0.4, y: 0.45 });
  });

  it('shifts rect x,y without changing width/height', () => {
    const rect = makeRect();
    const moved = moveAnnotation(rect, 0.1, 0.1) as RectAnnotation;
    expect(moved.x).toBeCloseTo(0.3);
    expect(moved.y).toBeCloseTo(0.4);
    expect(moved.width).toBe(0.4);
    expect(moved.height).toBe(0.3);
  });

  it('shifts arrow start and end', () => {
    const arrow = makeArrow();
    const moved = moveAnnotation(arrow, 0.1, 0.1) as ArrowAnnotation;
    expect(moved.start.x).toBeCloseTo(0.2);
    expect(moved.start.y).toBeCloseTo(0.3);
    expect(moved.end.x).toBeCloseTo(0.6);
    expect(moved.end.y).toBeCloseTo(0.7);
  });

  it('clamps to [0,1] bounds', () => {
    const pen = makePen({ points: [{ x: 0.9, y: 0.95 }] });
    const moved = moveAnnotation(pen, 0.2, 0.2) as PenAnnotation;
    expect(moved.points[0].x).toBe(1);
    expect(moved.points[0].y).toBe(1);

    const pen2 = makePen({ points: [{ x: 0.05, y: 0.1 }] });
    const moved2 = moveAnnotation(pen2, -0.1, -0.2) as PenAnnotation;
    expect(moved2.points[0].x).toBe(0);
    expect(moved2.points[0].y).toBe(0);
  });
});

describe('resizeAnnotation', () => {
  it('SE anchor increases width and height', () => {
    const rect = makeRect();
    const resized = resizeAnnotation(rect, 'se', 0.1, 0.1) as RectAnnotation;
    expect(resized.width).toBeCloseTo(0.5);
    expect(resized.height).toBeCloseTo(0.4);
    expect(resized.x).toBeCloseTo(0.2);
    expect(resized.y).toBeCloseTo(0.3);
  });

  it('NW anchor moves x,y and adjusts width/height', () => {
    const rect = makeRect();
    const resized = resizeAnnotation(rect, 'nw', 0.05, 0.05) as RectAnnotation;
    expect(resized.x).toBeCloseTo(0.25);
    expect(resized.y).toBeCloseTo(0.35);
    expect(resized.width).toBeCloseTo(0.35);
    expect(resized.height).toBeCloseTo(0.25);
  });

  it('enforces minimum size of 0.01', () => {
    const rect = makeRect({ width: 0.05, height: 0.05 });
    const resized = resizeAnnotation(rect, 'se', -0.1, -0.1) as RectAnnotation;
    expect(resized.width).toBe(0.01);
    expect(resized.height).toBe(0.01);
  });
});

describe('z-order operations', () => {
  const annotations: Annotation[] = [
    makeRect({ id: 'a1', zIndex: 1 }),
    makeRect({ id: 'a2', zIndex: 3 }),
    makeRect({ id: 'a3', zIndex: 5 }),
  ];

  it('bringToFront returns maxZ + 1', () => {
    expect(bringToFront(annotations[0], annotations)).toBe(6);
  });

  it('sendToBack returns minZ - 1', () => {
    expect(sendToBack(annotations[2], annotations)).toBe(0);
  });

  it('bringForward returns zIndex of element above', () => {
    expect(bringForward(annotations[0], annotations)).toBe(3);
  });

  it('sendBackward returns zIndex of element below', () => {
    expect(sendBackward(annotations[2], annotations)).toBe(3);
  });
});

describe('rotateAnnotation', () => {
  it('sets rotation field', () => {
    const rect = makeRect();
    const rotated = rotateAnnotation(rect, 45);
    expect(rotated.rotation).toBe(45);
  });
});
