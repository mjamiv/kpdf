import { describe, it, expect } from 'vitest';
import { getStamp, getStampLabel, STAMP_LIBRARY } from './stamps';

describe('stamps', () => {
  describe('STAMP_LIBRARY', () => {
    it('has 6 stamp types', () => {
      expect(STAMP_LIBRARY).toHaveLength(6);
    });

    it('each stamp has required fields', () => {
      for (const stamp of STAMP_LIBRARY) {
        expect(stamp.id).toBeTruthy();
        expect(stamp.label).toBeTruthy();
        expect(stamp.color).toMatch(/^#/);
        expect(stamp.defaultWidth).toBeGreaterThan(0);
        expect(stamp.defaultHeight).toBeGreaterThan(0);
      }
    });
  });

  describe('getStamp', () => {
    it('returns stamp for known id', () => {
      const stamp = getStamp('approved');
      expect(stamp).toBeDefined();
      expect(stamp!.label).toBe('APPROVED');
    });

    it('returns undefined for unknown id', () => {
      expect(getStamp('nonexistent')).toBeUndefined();
    });
  });

  describe('getStampLabel', () => {
    it('returns label for known id', () => {
      expect(getStampLabel('approved')).toBe('APPROVED');
      expect(getStampLabel('confidential')).toBe('CONFIDENTIAL');
    });

    it('returns uppercased id as fallback for unknown id', () => {
      expect(getStampLabel('custom')).toBe('CUSTOM');
    });
  });
});
