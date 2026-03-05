import { describe, it, expect } from 'vitest';
import { getToolForKey, TOOL_SHORTCUTS } from './shortcuts';

describe('shortcuts', () => {
  describe('TOOL_SHORTCUTS', () => {
    it('has entries for all tools', () => {
      expect(TOOL_SHORTCUTS.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe('getToolForKey', () => {
    it('returns tool for valid key', () => {
      expect(getToolForKey('v')).toBe('select');
      expect(getToolForKey('p')).toBe('pen');
      expect(getToolForKey('r')).toBe('rectangle');
    });

    it('is case-insensitive', () => {
      expect(getToolForKey('V')).toBe('select');
      expect(getToolForKey('P')).toBe('pen');
    });

    it('returns null for invalid key', () => {
      expect(getToolForKey(' ')).toBeNull();
      expect(getToolForKey('')).toBeNull();
    });
  });
});
