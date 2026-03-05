import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStamp,
  getStampLabel,
  STAMP_LIBRARY,
  AEC_STAMPS,
  getAllStamps,
  addCustomStamp,
  removeCustomStamp,
  loadCustomStamps,
  saveCustomStamps,
  type StampDef,
} from './stamps';

// Mock localStorage for Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

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

    it('all built-in stamps have status category', () => {
      for (const stamp of STAMP_LIBRARY) {
        expect(stamp.category).toBe('status');
      }
    });
  });

  describe('AEC_STAMPS', () => {
    it('has 7 AEC stamp types', () => {
      expect(AEC_STAMPS).toHaveLength(7);
    });

    it('all AEC stamps have aec category', () => {
      for (const stamp of AEC_STAMPS) {
        expect(stamp.category).toBe('aec');
      }
    });

    it('contains expected AEC stamps', () => {
      const ids = AEC_STAMPS.map((s) => s.id);
      expect(ids).toContain('rfi');
      expect(ids).toContain('asi');
      expect(ids).toContain('co');
      expect(ids).toContain('punch');
      expect(ids).toContain('hold');
      expect(ids).toContain('verified');
      expect(ids).toContain('not-approved');
    });
  });

  describe('getStamp', () => {
    beforeEach(() => { localStorageMock.clear(); });

    it('returns stamp for known id', () => {
      const stamp = getStamp('approved');
      expect(stamp).toBeDefined();
      expect(stamp!.label).toBe('APPROVED');
    });

    it('returns AEC stamp by id', () => {
      const stamp = getStamp('rfi');
      expect(stamp).toBeDefined();
      expect(stamp!.label).toBe('RFI');
    });

    it('returns undefined for unknown id', () => {
      expect(getStamp('nonexistent')).toBeUndefined();
    });
  });

  describe('getStampLabel', () => {
    beforeEach(() => { localStorageMock.clear(); });

    it('returns label for known id', () => {
      expect(getStampLabel('approved')).toBe('APPROVED');
      expect(getStampLabel('confidential')).toBe('CONFIDENTIAL');
    });

    it('returns label for AEC stamp', () => {
      expect(getStampLabel('rfi')).toBe('RFI');
    });

    it('returns uppercased id as fallback for unknown id', () => {
      expect(getStampLabel('custom')).toBe('CUSTOM');
    });
  });

  describe('getAllStamps', () => {
    beforeEach(() => { localStorageMock.clear(); });

    it('returns built-in + AEC stamps when no custom stamps', () => {
      const all = getAllStamps();
      expect(all.length).toBe(STAMP_LIBRARY.length + AEC_STAMPS.length);
    });

    it('includes custom stamps from localStorage', () => {
      const custom: StampDef = {
        id: 'test-custom',
        label: 'TEST',
        color: '#000',
        defaultWidth: 0.08,
        defaultHeight: 0.04,
        category: 'custom',
      };
      saveCustomStamps([custom]);
      const all = getAllStamps();
      expect(all.length).toBe(STAMP_LIBRARY.length + AEC_STAMPS.length + 1);
      expect(all.find((s) => s.id === 'test-custom')).toBeDefined();
    });
  });

  describe('custom stamps', () => {
    beforeEach(() => { localStorageMock.clear(); });

    it('addCustomStamp adds to localStorage', () => {
      addCustomStamp({
        id: 'my-stamp',
        label: 'MY STAMP',
        color: '#ff0000',
        defaultWidth: 0.08,
        defaultHeight: 0.04,
      });
      const loaded = loadCustomStamps();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('my-stamp');
      expect(loaded[0].category).toBe('custom');
    });

    it('removeCustomStamp removes from localStorage', () => {
      addCustomStamp({ id: 'a', label: 'A', color: '#000', defaultWidth: 0.08, defaultHeight: 0.04 });
      addCustomStamp({ id: 'b', label: 'B', color: '#000', defaultWidth: 0.08, defaultHeight: 0.04 });
      removeCustomStamp('a');
      const loaded = loadCustomStamps();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('b');
    });

    it('loadCustomStamps returns empty array on invalid JSON', () => {
      localStorageMock.setItem('kpdf-custom-stamps', 'invalid json');
      expect(loadCustomStamps()).toEqual([]);
    });
  });
});
