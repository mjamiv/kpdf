import { describe, it, expect } from 'vitest';
import { createReviewState, isToolAllowed, getAllowedTools } from './reviewMode';

describe('reviewMode', () => {
  describe('createReviewState', () => {
    it('starts inactive', () => {
      expect(createReviewState().active).toBe(false);
    });
  });

  describe('isToolAllowed', () => {
    it('allows all tools when inactive', () => {
      const review = { active: false };
      expect(isToolAllowed('pen', review)).toBe(true);
      expect(isToolAllowed('rectangle', review)).toBe(true);
      expect(isToolAllowed('select', review)).toBe(true);
    });

    it('only allows select when active', () => {
      const review = { active: true };
      expect(isToolAllowed('select', review)).toBe(true);
      expect(isToolAllowed('pen', review)).toBe(false);
      expect(isToolAllowed('rectangle', review)).toBe(false);
      expect(isToolAllowed('text', review)).toBe(false);
      expect(isToolAllowed('stamp', review)).toBe(false);
    });
  });

  describe('getAllowedTools', () => {
    it('returns all tools when inactive', () => {
      const tools = getAllowedTools({ active: false });
      expect(tools.length).toBe(11);
      expect(tools).toContain('pen');
      expect(tools).toContain('select');
    });

    it('returns only select when active', () => {
      const tools = getAllowedTools({ active: true });
      expect(tools).toEqual(['select']);
    });
  });
});
