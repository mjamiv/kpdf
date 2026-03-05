import { describe, it, expect } from 'vitest';
import { extractComments, filterComments, getCommentAuthors } from './comments';
import type { Annotation } from '../types';

const makeAnn = (overrides: Partial<Annotation> & { id: string; type: 'rectangle' }): Annotation => ({
  zIndex: 1,
  color: '#000',
  author: 'alice',
  createdAt: '',
  updatedAt: '',
  locked: false,
  x: 0,
  y: 0,
  width: 0.1,
  height: 0.1,
  thickness: 0.002,
  ...overrides,
});

describe('comments', () => {
  const annotationsByPage: Record<number, Annotation[]> = {
    1: [
      makeAnn({ id: '1', type: 'rectangle', comment: 'Fix alignment', author: 'alice', status: 'open' }),
      makeAnn({ id: '2', type: 'rectangle', comment: 'Looks good', author: 'bob', status: 'resolved' }),
      makeAnn({ id: '3', type: 'rectangle' }), // no comment
    ],
    2: [
      makeAnn({ id: '4', type: 'rectangle', comment: 'Needs revision', author: 'alice', status: 'open' }),
    ],
  };

  describe('extractComments', () => {
    it('extracts only annotations with non-empty comments', () => {
      const comments = extractComments(annotationsByPage);
      expect(comments).toHaveLength(3);
      expect(comments.map(c => c.annotation.id)).toEqual(['1', '2', '4']);
    });

    it('returns entries sorted by page', () => {
      const comments = extractComments(annotationsByPage);
      expect(comments[0].page).toBe(1);
      expect(comments[2].page).toBe(2);
    });

    it('returns empty array for empty input', () => {
      expect(extractComments({})).toEqual([]);
    });

    it('ignores whitespace-only comments', () => {
      const data = { 1: [makeAnn({ id: 'x', type: 'rectangle', comment: '   ' })] };
      expect(extractComments(data)).toEqual([]);
    });
  });

  describe('filterComments', () => {
    const comments = extractComments(annotationsByPage);

    it('filters by author', () => {
      const result = filterComments(comments, { author: 'alice' });
      expect(result).toHaveLength(2);
      expect(result.every(c => c.annotation.author === 'alice')).toBe(true);
    });

    it('filters by status', () => {
      const result = filterComments(comments, { status: 'open' });
      expect(result).toHaveLength(2);
    });

    it('filters by page', () => {
      const result = filterComments(comments, { page: 2 });
      expect(result).toHaveLength(1);
      expect(result[0].annotation.id).toBe('4');
    });

    it('combines filters', () => {
      const result = filterComments(comments, { author: 'alice', page: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].annotation.id).toBe('1');
    });

    it('returns all when no filter', () => {
      expect(filterComments(comments, {})).toHaveLength(3);
    });
  });

  describe('getCommentAuthors', () => {
    it('returns unique sorted authors', () => {
      const comments = extractComments(annotationsByPage);
      expect(getCommentAuthors(comments)).toEqual(['alice', 'bob']);
    });

    it('returns empty array for no comments', () => {
      expect(getCommentAuthors([])).toEqual([]);
    });
  });
});
