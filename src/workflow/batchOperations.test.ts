import { describe, it, expect } from 'vitest';
import type { AnnotationsByPage, StampAnnotation, Annotation } from '../types';
import {
  batchApplyStamp,
  batchNumberAnnotations,
  batchUpdateStatus,
} from './batchOperations';

function makeStamp(overrides: Partial<StampAnnotation> = {}): StampAnnotation {
  return {
    id: 'stamp-1',
    type: 'stamp',
    zIndex: 1,
    color: '#16a34a',
    author: 'test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    locked: false,
    x: 0.1,
    y: 0.1,
    width: 0.08,
    height: 0.04,
    stampId: 'approved',
    label: 'APPROVED',
    ...overrides,
  };
}

function makePenAnnotation(id: string): Annotation {
  return {
    id,
    type: 'pen',
    zIndex: 1,
    color: '#000',
    author: 'test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    locked: false,
    points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }],
    thickness: 0.002,
  };
}

describe('batchApplyStamp', () => {
  it('applies stamp to multiple pages', () => {
    const initial: AnnotationsByPage = {};
    const stamp = makeStamp();
    const result = batchApplyStamp(initial, stamp, [1, 2, 3]);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result[1]).toHaveLength(1);
    expect(result[2]).toHaveLength(1);
    expect(result[3]).toHaveLength(1);
  });

  it('creates unique IDs for each page copy', () => {
    const initial: AnnotationsByPage = {};
    const stamp = makeStamp();
    const result = batchApplyStamp(initial, stamp, [1, 2]);

    expect(result[1]![0].id).not.toBe(result[2]![0].id);
  });

  it('preserves existing annotations', () => {
    const existing = makePenAnnotation('existing-1');
    const initial: AnnotationsByPage = { 1: [existing] };
    const stamp = makeStamp();
    const result = batchApplyStamp(initial, stamp, [1]);

    expect(result[1]).toHaveLength(2);
    expect(result[1]![0].id).toBe('existing-1');
    expect(result[1]![1].type).toBe('stamp');
  });

  it('assigns correct zIndex above existing annotations', () => {
    const existing = makePenAnnotation('existing-1');
    existing.zIndex = 5;
    const initial: AnnotationsByPage = { 1: [existing] };
    const stamp = makeStamp();
    const result = batchApplyStamp(initial, stamp, [1]);

    expect(result[1]![1].zIndex).toBe(6);
  });

  it('copies stamp properties', () => {
    const initial: AnnotationsByPage = {};
    const stamp = makeStamp({ label: 'REVISION', stampId: 'revision' });
    const result = batchApplyStamp(initial, stamp, [1]);

    const created = result[1]![0] as StampAnnotation;
    expect(created.label).toBe('REVISION');
    expect(created.stampId).toBe('revision');
    expect(created.x).toBe(0.1);
  });
});

describe('batchNumberAnnotations', () => {
  it('numbers annotations sequentially across pages', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1'), makePenAnnotation('a2')],
      2: [makePenAnnotation('a3')],
    };

    const result = batchNumberAnnotations(initial);
    expect(result[1]![0].comment).toBe('#1');
    expect(result[1]![1].comment).toBe('#2');
    expect(result[2]![0].comment).toBe('#3');
  });

  it('uses custom prefix', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1')],
    };

    const result = batchNumberAnnotations(initial, 'RFI-');
    expect(result[1]![0].comment).toBe('RFI-1');
  });

  it('processes pages in order', () => {
    const initial: AnnotationsByPage = {
      3: [makePenAnnotation('a3')],
      1: [makePenAnnotation('a1')],
    };

    const result = batchNumberAnnotations(initial);
    expect(result[1]![0].comment).toBe('#1');
    expect(result[3]![0].comment).toBe('#2');
  });

  it('handles empty input', () => {
    const result = batchNumberAnnotations({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('batchUpdateStatus', () => {
  it('updates status of specified annotations', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1'), makePenAnnotation('a2')],
    };

    const result = batchUpdateStatus(initial, ['a1'], 'resolved');
    expect(result[1]![0].status).toBe('resolved');
    expect(result[1]![1].status).toBeUndefined();
  });

  it('updates multiple annotations across pages', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1')],
      2: [makePenAnnotation('a2')],
    };

    const result = batchUpdateStatus(initial, ['a1', 'a2'], 'rejected');
    expect(result[1]![0].status).toBe('rejected');
    expect(result[2]![0].status).toBe('rejected');
  });

  it('does not modify annotations not in the ID list', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1'), makePenAnnotation('a2')],
    };

    const result = batchUpdateStatus(initial, ['a1'], 'open');
    expect(result[1]![0].status).toBe('open');
    expect(result[1]![1].status).toBeUndefined();
  });

  it('handles empty ID list', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1')],
    };

    const result = batchUpdateStatus(initial, [], 'resolved');
    expect(result[1]![0].status).toBeUndefined();
  });

  it('updates the updatedAt timestamp', () => {
    const initial: AnnotationsByPage = {
      1: [makePenAnnotation('a1')],
    };

    const result = batchUpdateStatus(initial, ['a1'], 'resolved');
    expect(result[1]![0].updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
  });
});
