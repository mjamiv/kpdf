import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STAMP_LIBRARY,
  AEC_STAMPS,
  getAllStamps,
  addCustomStamp,
  removeCustomStamp,
  loadCustomStamps,
} from '../workflow/stamps';

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

describe('StampPicker data logic', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('getAllStamps includes status and AEC categories', () => {
    const stamps = getAllStamps();
    const categories = new Set(stamps.map((s) => s.category));
    expect(categories.has('status')).toBe(true);
    expect(categories.has('aec')).toBe(true);
  });

  it('stamps can be grouped by category', () => {
    const stamps = getAllStamps();
    const grouped: Record<string, typeof stamps> = {};
    for (const s of stamps) {
      const cat = s.category ?? 'status';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }
    expect(grouped['status']?.length).toBe(STAMP_LIBRARY.length);
    expect(grouped['aec']?.length).toBe(AEC_STAMPS.length);
  });

  it('custom stamps appear in custom category', () => {
    addCustomStamp({
      id: 'test',
      label: 'TEST',
      color: '#000',
      defaultWidth: 0.08,
      defaultHeight: 0.04,
    });
    const stamps = getAllStamps();
    const custom = stamps.filter((s) => s.category === 'custom');
    expect(custom.length).toBe(1);
    expect(custom[0].label).toBe('TEST');
  });

  it('custom stamps can be deleted', () => {
    addCustomStamp({ id: 'a', label: 'A', color: '#000', defaultWidth: 0.08, defaultHeight: 0.04 });
    addCustomStamp({ id: 'b', label: 'B', color: '#000', defaultWidth: 0.08, defaultHeight: 0.04 });
    removeCustomStamp('a');
    const customs = loadCustomStamps();
    expect(customs.length).toBe(1);
    expect(customs[0].id).toBe('b');
  });

  it('image stamps have imageUrl field', () => {
    addCustomStamp({
      id: 'img-stamp',
      label: 'IMG',
      color: '#000',
      defaultWidth: 0.08,
      defaultHeight: 0.04,
      imageUrl: 'data:image/png;base64,abc',
    });
    const customs = loadCustomStamps();
    expect(customs[0].imageUrl).toBe('data:image/png;base64,abc');
  });
});
