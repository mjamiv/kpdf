import { describe, expect, it } from 'vitest';
import type { Annotation } from '../types';
import type { Action } from './actions';
import { annotationReducer, computeInverse, type DocumentState } from './state';

function makeAnnotation(overrides: Partial<Annotation> & { id: string; type: 'pen' }): Annotation {
  return {
    zIndex: 1,
    color: '#000',
    author: 'test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    locked: false,
    points: [{ x: 0, y: 0 }],
    thickness: 1,
    ...overrides,
  };
}

function emptyState(): DocumentState {
  return { annotationsByPage: {} };
}

const ann1 = makeAnnotation({ id: 'a1', type: 'pen', zIndex: 1 });
const ann2 = makeAnnotation({ id: 'a2', type: 'pen', zIndex: 2 });
const ann3 = makeAnnotation({ id: 'a3', type: 'pen', zIndex: 3, locked: true });

describe('annotationReducer', () => {
  describe('ADD_ANNOTATION', () => {
    it('adds to empty page', () => {
      const state = emptyState();
      const result = annotationReducer(state, { type: 'ADD_ANNOTATION', page: 1, annotation: ann1 });
      expect(result.annotationsByPage[1]).toEqual([ann1]);
    });

    it('appends to existing page', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
      const result = annotationReducer(state, { type: 'ADD_ANNOTATION', page: 1, annotation: ann2 });
      expect(result.annotationsByPage[1]).toHaveLength(2);
      expect(result.annotationsByPage[1]![1]).toEqual(ann2);
    });
  });

  describe('REMOVE_ANNOTATION', () => {
    it('removes annotation by id', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2] } };
      const result = annotationReducer(state, { type: 'REMOVE_ANNOTATION', page: 1, id: 'a1' });
      expect(result.annotationsByPage[1]).toHaveLength(1);
      expect(result.annotationsByPage[1]![0].id).toBe('a2');
    });

    it('returns empty array when removing last annotation', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
      const result = annotationReducer(state, { type: 'REMOVE_ANNOTATION', page: 1, id: 'a1' });
      expect(result.annotationsByPage[1]).toHaveLength(0);
    });
  });

  describe('UPDATE_ANNOTATION', () => {
    it('applies partial patch', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
      const result = annotationReducer(state, {
        type: 'UPDATE_ANNOTATION',
        page: 1,
        id: 'a1',
        patch: { color: '#ff0000' },
      });
      expect(result.annotationsByPage[1]![0].color).toBe('#ff0000');
      expect(result.annotationsByPage[1]![0].id).toBe('a1');
    });
  });

  describe('CLEAR_PAGE', () => {
    it('removes unlocked annotations, keeps locked', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
      const result = annotationReducer(state, { type: 'CLEAR_PAGE', page: 1 });
      expect(result.annotationsByPage[1]).toHaveLength(1);
      expect(result.annotationsByPage[1]![0].id).toBe('a3');
    });

    it('clears page with no locked annotations', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2] } };
      const result = annotationReducer(state, { type: 'CLEAR_PAGE', page: 1 });
      expect(result.annotationsByPage[1]).toHaveLength(0);
    });
  });

  describe('LOAD_PAGE', () => {
    it('replaces entire page', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
      const result = annotationReducer(state, { type: 'LOAD_PAGE', page: 1, annotations: [ann2, ann3] });
      expect(result.annotationsByPage[1]).toEqual([ann2, ann3]);
    });
  });

  describe('SET_Z_ORDER', () => {
    it('brings annotation to front', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
      const result = annotationReducer(state, { type: 'SET_Z_ORDER', page: 1, id: 'a1', op: 'front' });
      const target = result.annotationsByPage[1]!.find((a) => a.id === 'a1')!;
      const maxZ = Math.max(...result.annotationsByPage[1]!.map((a) => a.zIndex));
      expect(target.zIndex).toBe(maxZ);
    });

    it('sends annotation to back', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
      const result = annotationReducer(state, { type: 'SET_Z_ORDER', page: 1, id: 'a3', op: 'back' });
      const target = result.annotationsByPage[1]!.find((a) => a.id === 'a3')!;
      const minZ = Math.min(...result.annotationsByPage[1]!.map((a) => a.zIndex));
      expect(target.zIndex).toBe(minZ);
    });

    it('moves annotation up one level', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
      const result = annotationReducer(state, { type: 'SET_Z_ORDER', page: 1, id: 'a1', op: 'up' });
      const a1 = result.annotationsByPage[1]!.find((a) => a.id === 'a1')!;
      const a2 = result.annotationsByPage[1]!.find((a) => a.id === 'a2')!;
      expect(a1.zIndex).toBe(2);
      expect(a2.zIndex).toBe(1);
    });

    it('moves annotation down one level', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
      const result = annotationReducer(state, { type: 'SET_Z_ORDER', page: 1, id: 'a2', op: 'down' });
      const a1 = result.annotationsByPage[1]!.find((a) => a.id === 'a1')!;
      const a2 = result.annotationsByPage[1]!.find((a) => a.id === 'a2')!;
      expect(a2.zIndex).toBe(1);
      expect(a1.zIndex).toBe(2);
    });
  });

  describe('LOCK_ANNOTATION', () => {
    it('locks an annotation', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
      const result = annotationReducer(state, { type: 'LOCK_ANNOTATION', page: 1, id: 'a1', locked: true });
      expect(result.annotationsByPage[1]![0].locked).toBe(true);
    });
  });

  describe('BATCH', () => {
    it('applies multiple actions sequentially', () => {
      const state = emptyState();
      const result = annotationReducer(state, {
        type: 'BATCH',
        actions: [
          { type: 'ADD_ANNOTATION', page: 1, annotation: ann1 },
          { type: 'ADD_ANNOTATION', page: 1, annotation: ann2 },
        ],
      });
      expect(result.annotationsByPage[1]).toHaveLength(2);
    });

    it('later actions see effects of earlier actions', () => {
      const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
      const result = annotationReducer(state, {
        type: 'BATCH',
        actions: [
          { type: 'ADD_ANNOTATION', page: 1, annotation: ann2 },
          { type: 'REMOVE_ANNOTATION', page: 1, id: 'a1' },
        ],
      });
      expect(result.annotationsByPage[1]).toHaveLength(1);
      expect(result.annotationsByPage[1]![0].id).toBe('a2');
    });
  });
});

describe('computeInverse', () => {
  it('ADD -> REMOVE', () => {
    const state = emptyState();
    const action: Action = { type: 'ADD_ANNOTATION', page: 1, annotation: ann1 };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('REMOVE_ANNOTATION');
    if (inverse.type === 'REMOVE_ANNOTATION') {
      expect(inverse.id).toBe('a1');
      expect(inverse.removed).toEqual(ann1);
    }
  });

  it('REMOVE -> ADD', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
    const action: Action = { type: 'REMOVE_ANNOTATION', page: 1, id: 'a1', removed: ann1 };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('ADD_ANNOTATION');
    if (inverse.type === 'ADD_ANNOTATION') {
      expect(inverse.annotation).toEqual(ann1);
    }
  });

  it('MOVE -> MOVE with negated deltas', () => {
    const state = emptyState();
    const action: Action = { type: 'MOVE_ANNOTATION', page: 1, id: 'a1', dx: 10, dy: -5 };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('MOVE_ANNOTATION');
    if (inverse.type === 'MOVE_ANNOTATION') {
      expect(inverse.dx).toBe(-10);
      expect(inverse.dy).toBe(5);
    }
  });

  it('UPDATE -> UPDATE with previous values', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
    const action: Action = { type: 'UPDATE_ANNOTATION', page: 1, id: 'a1', patch: { color: '#ff0000' } };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('UPDATE_ANNOTATION');
    if (inverse.type === 'UPDATE_ANNOTATION') {
      expect(inverse.patch).toEqual({ color: '#000' });
    }
  });

  it('CLEAR_PAGE -> BATCH of ADDs for removed annotations', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
    const action: Action = { type: 'CLEAR_PAGE', page: 1 };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('BATCH');
    if (inverse.type === 'BATCH') {
      expect(inverse.actions).toHaveLength(2);
      expect(inverse.actions[0].type).toBe('ADD_ANNOTATION');
      expect(inverse.actions[1].type).toBe('ADD_ANNOTATION');
    }
  });

  it('RESIZE -> RESIZE with negated deltas', () => {
    const state = emptyState();
    const action: Action = { type: 'RESIZE_ANNOTATION', page: 1, id: 'a1', anchor: 'se', dx: 0.1, dy: 0.2 };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('RESIZE_ANNOTATION');
    if (inverse.type === 'RESIZE_ANNOTATION') {
      expect(inverse.dx).toBe(-0.1);
      expect(inverse.dy).toBe(-0.2);
      expect(inverse.anchor).toBe('se');
    }
  });

  it('LOCK -> LOCK with toggled value', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
    const action: Action = { type: 'LOCK_ANNOTATION', page: 1, id: 'a1', locked: true };
    const inverse = computeInverse(state, action);
    expect(inverse.type).toBe('LOCK_ANNOTATION');
    if (inverse.type === 'LOCK_ANNOTATION') {
      expect(inverse.locked).toBe(false);
    }
  });
});

describe('computeInverse roundtrip', () => {
  it('ADD → inverse → restores original state', () => {
    const state = emptyState();
    const action: Action = { type: 'ADD_ANNOTATION', page: 1, annotation: ann1 };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    expect(restored.annotationsByPage[1] ?? []).toEqual([]);
  });

  it('REMOVE → inverse → restores original state', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2] } };
    const action: Action = { type: 'REMOVE_ANNOTATION', page: 1, id: 'a1', removed: ann1 };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    expect(restored.annotationsByPage[1]).toHaveLength(2);
    const ids = restored.annotationsByPage[1]!.map((a) => a.id).sort();
    expect(ids).toEqual(['a1', 'a2']);
  });

  it('MOVE → inverse → restores original state', () => {
    const rectAnn: Annotation = {
      id: 'r1', type: 'rectangle', zIndex: 1, color: '#f00', author: 'test',
      createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
      locked: false, x: 0.2, y: 0.3, width: 0.1, height: 0.1, thickness: 1,
    };
    const state: DocumentState = { annotationsByPage: { 1: [rectAnn] } };
    const action: Action = { type: 'MOVE_ANNOTATION', page: 1, id: 'r1', dx: 0.05, dy: -0.1 };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    const r = restored.annotationsByPage[1]![0];
    expect(r.type).toBe('rectangle');
    if (r.type === 'rectangle') {
      expect(r.x).toBeCloseTo(0.2);
      expect(r.y).toBeCloseTo(0.3);
    }
  });

  it('UPDATE → inverse → restores original state', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
    const action: Action = { type: 'UPDATE_ANNOTATION', page: 1, id: 'a1', patch: { color: '#ff0000' } };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    expect(restored.annotationsByPage[1]![0].color).toBe('#000');
  });

  it('CLEAR_PAGE → inverse → restores removed annotations', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1, ann2, ann3] } };
    const action: Action = { type: 'CLEAR_PAGE', page: 1 };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    // Locked annotation (ann3) was never removed, unlocked ones restored
    expect(restored.annotationsByPage[1]).toHaveLength(3);
  });

  it('LOCK → inverse → restores original state', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
    const action: Action = { type: 'LOCK_ANNOTATION', page: 1, id: 'a1', locked: true };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    expect(restored.annotationsByPage[1]![0].locked).toBe(false);
  });

  it('LOAD_PAGE → inverse → restores original page', () => {
    const state: DocumentState = { annotationsByPage: { 1: [ann1] } };
    const action: Action = { type: 'LOAD_PAGE', page: 1, annotations: [ann2, ann3] };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    expect(restored).toEqual(state);
  });

  it('BATCH → inverse → restores original state', () => {
    const state = emptyState();
    const action: Action = {
      type: 'BATCH',
      actions: [
        { type: 'ADD_ANNOTATION', page: 1, annotation: ann1 },
        { type: 'ADD_ANNOTATION', page: 1, annotation: ann2 },
      ],
    };
    const after = annotationReducer(state, action);
    const inverse = computeInverse(state, action);
    const restored = annotationReducer(after, inverse);
    expect(restored.annotationsByPage[1] ?? []).toEqual([]);
  });
});
