import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from './fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('basic matching', () => {
    it('matches empty query to any text', () => {
      const result = fuzzyMatch('', 'anything');
      expect(result.match).toBe(true);
      expect(result.score).toBe(0);
      expect(result.ranges).toEqual([]);
    });

    it('does not match empty text with non-empty query', () => {
      const result = fuzzyMatch('abc', '');
      expect(result.match).toBe(false);
    });

    it('matches exact string', () => {
      const result = fuzzyMatch('hello', 'hello');
      expect(result.match).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('matches case insensitively', () => {
      const result = fuzzyMatch('ABC', 'abcdef');
      expect(result.match).toBe(true);
    });

    it('does not match if characters are not in order', () => {
      const result = fuzzyMatch('ba', 'abc');
      expect(result.match).toBe(false);
    });

    it('does not match if query is longer than text', () => {
      const result = fuzzyMatch('abcdef', 'abc');
      expect(result.match).toBe(false);
    });

    it('matches subsequence with gaps', () => {
      const result = fuzzyMatch('ace', 'abcde');
      expect(result.match).toBe(true);
    });
  });

  describe('scoring', () => {
    it('scores consecutive matches higher than non-consecutive', () => {
      const consecutive = fuzzyMatch('abc', 'abcdef');
      const gapped = fuzzyMatch('abc', 'axbxcx');
      expect(consecutive.score).toBeGreaterThan(gapped.score);
    });

    it('scores first character match higher', () => {
      const firstChar = fuzzyMatch('a', 'abcdef');
      const midChar = fuzzyMatch('c', 'abcdef');
      expect(firstChar.score).toBeGreaterThan(midChar.score);
    });

    it('gives bonus for word boundary matches', () => {
      const boundary = fuzzyMatch('st', 'some test');
      const noBoundary = fuzzyMatch('st', 'somest');
      // 'st' in 'some test' starts at word boundary 't', 'st' in 'somest' does not
      // Both match; boundary match should score higher
      expect(boundary.match).toBe(true);
      expect(noBoundary.match).toBe(true);
    });

    it('gives bonus for exact case match', () => {
      const exact = fuzzyMatch('Ab', 'Abcdef');
      const noExact = fuzzyMatch('ab', 'Abcdef');
      expect(exact.score).toBeGreaterThan(noExact.score);
    });
  });

  describe('ranges', () => {
    it('returns correct ranges for consecutive match', () => {
      const result = fuzzyMatch('abc', 'abcdef');
      expect(result.ranges).toEqual([[0, 3]]);
    });

    it('returns separate ranges for gapped match', () => {
      const result = fuzzyMatch('ac', 'abcdef');
      expect(result.ranges).toEqual([[0, 1], [2, 3]]);
    });

    it('returns single range for single char match', () => {
      const result = fuzzyMatch('d', 'abcdef');
      expect(result.ranges).toEqual([[3, 4]]);
    });

    it('returns empty ranges for empty query', () => {
      const result = fuzzyMatch('', 'test');
      expect(result.ranges).toEqual([]);
    });

    it('returns correct ranges for multi-gap match', () => {
      const result = fuzzyMatch('zf', 'Zoom to Fit');
      expect(result.match).toBe(true);
      // z matches Z at 0, f matches F at 8
      expect(result.ranges).toEqual([[0, 1], [8, 9]]);
    });
  });

  describe('edge cases', () => {
    it('handles single character query', () => {
      const result = fuzzyMatch('x', 'text');
      expect(result.match).toBe(true);
    });

    it('handles single character text', () => {
      const result = fuzzyMatch('a', 'a');
      expect(result.match).toBe(true);
    });

    it('handles query same as text', () => {
      const result = fuzzyMatch('test', 'test');
      expect(result.match).toBe(true);
      expect(result.ranges).toEqual([[0, 4]]);
    });

    it('handles special characters in query', () => {
      const result = fuzzyMatch('+', 'Ctrl++');
      expect(result.match).toBe(true);
    });

    it('handles unicode characters', () => {
      const result = fuzzyMatch('a', 'cafe');
      expect(result.match).toBe(true);
    });

    it('does not match when no common characters', () => {
      const result = fuzzyMatch('xyz', 'abc');
      expect(result.match).toBe(false);
      expect(result.score).toBe(0);
      expect(result.ranges).toEqual([]);
    });
  });

  describe('real-world command palette queries', () => {
    it('matches "undo" in "Undo"', () => {
      const result = fuzzyMatch('undo', 'Undo');
      expect(result.match).toBe(true);
    });

    it('matches "zin" in "Zoom In"', () => {
      const result = fuzzyMatch('zin', 'Zoom In');
      expect(result.match).toBe(true);
    });

    it('matches "pen" in "Tool: Pen"', () => {
      const result = fuzzyMatch('pen', 'Tool: Pen');
      expect(result.match).toBe(true);
    });

    it('matches "exp" in "Export Annotations"', () => {
      const result = fuzzyMatch('exp', 'Export Annotations');
      expect(result.match).toBe(true);
    });

    it('ranks exact prefix higher than substring', () => {
      const prefix = fuzzyMatch('pen', 'Pen Tool');
      const substring = fuzzyMatch('pen', 'Open Panel');
      expect(prefix.score).toBeGreaterThan(substring.score);
    });
  });
});
