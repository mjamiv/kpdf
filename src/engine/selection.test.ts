import { describe, it, expect } from 'vitest';
import {
  createSelectionState,
  selectAnnotation,
  toggleAnnotation,
  deselectAll,
} from './selection';
import type { Annotation } from '../types';

const makeAnn = (id: string, locked = false): Annotation => ({
  id,
  type: 'rectangle',
  zIndex: 1,
  color: '#000',
  author: 'test',
  createdAt: '',
  updatedAt: '',
  locked,
  x: 0,
  y: 0,
  width: 0.1,
  height: 0.1,
  thickness: 0.002,
});

describe('selection', () => {
  const annotations = [makeAnn('a'), makeAnn('b'), makeAnn('locked', true)];

  describe('createSelectionState', () => {
    it('returns empty selection', () => {
      const s = createSelectionState();
      expect(s.ids.size).toBe(0);
      expect(s.activeHandle).toBeNull();
      expect(s.dragOrigin).toBeNull();
    });
  });

  describe('selectAnnotation', () => {
    it('selects an unlocked annotation', () => {
      const s = selectAnnotation(createSelectionState(), 'a', annotations);
      expect(s.ids.has('a')).toBe(true);
      expect(s.ids.size).toBe(1);
    });

    it('refuses to select a locked annotation', () => {
      const initial = createSelectionState();
      const s = selectAnnotation(initial, 'locked', annotations);
      expect(s).toBe(initial);
      expect(s.ids.size).toBe(0);
    });

    it('refuses to select a non-existent annotation', () => {
      const initial = createSelectionState();
      const s = selectAnnotation(initial, 'missing', annotations);
      expect(s).toBe(initial);
    });

    it('replaces previous selection', () => {
      const s1 = selectAnnotation(createSelectionState(), 'a', annotations);
      const s2 = selectAnnotation(s1, 'b', annotations);
      expect(s2.ids.has('b')).toBe(true);
      expect(s2.ids.has('a')).toBe(false);
      expect(s2.ids.size).toBe(1);
    });
  });

  describe('toggleAnnotation', () => {
    it('adds annotation to selection', () => {
      const s = toggleAnnotation(createSelectionState(), 'a', annotations);
      expect(s.ids.has('a')).toBe(true);
    });

    it('removes annotation from selection if already selected', () => {
      const s1 = toggleAnnotation(createSelectionState(), 'a', annotations);
      const s2 = toggleAnnotation(s1, 'a', annotations);
      expect(s2.ids.has('a')).toBe(false);
      expect(s2.ids.size).toBe(0);
    });

    it('refuses to toggle a locked annotation', () => {
      const initial = createSelectionState();
      const s = toggleAnnotation(initial, 'locked', annotations);
      expect(s).toBe(initial);
    });

    it('supports multi-select', () => {
      const s1 = toggleAnnotation(createSelectionState(), 'a', annotations);
      const s2 = toggleAnnotation(s1, 'b', annotations);
      expect(s2.ids.size).toBe(2);
      expect(s2.ids.has('a')).toBe(true);
      expect(s2.ids.has('b')).toBe(true);
    });
  });

  describe('deselectAll', () => {
    it('returns empty selection', () => {
      const s = deselectAll();
      expect(s.ids.size).toBe(0);
    });
  });
});
