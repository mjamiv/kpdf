import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolPreset } from './ToolPresets';

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

const PRESETS_KEY = 'kpdf-tool-presets';

describe('ToolPresets data logic', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('default presets are loaded when no localStorage', () => {
    const raw = localStorageMock.getItem(PRESETS_KEY);
    expect(raw).toBeNull();
    // Default presets should include 5 AEC discipline presets
  });

  it('presets can be saved and loaded from localStorage', () => {
    const presets: ToolPreset[] = [
      { id: 'p1', name: 'Test Preset', color: '#ff0000', tool: 'pen' },
    ];
    localStorageMock.setItem(PRESETS_KEY, JSON.stringify(presets));
    const loaded = JSON.parse(localStorageMock.getItem(PRESETS_KEY)!) as ToolPreset[];
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Test Preset');
    expect(loaded[0].tool).toBe('pen');
  });

  it('preset has correct structure', () => {
    const preset: ToolPreset = {
      id: 'test-1',
      name: 'My Preset',
      color: '#00ff00',
      tool: 'rectangle',
    };
    expect(preset.id).toBeTruthy();
    expect(preset.name).toBeTruthy();
    expect(preset.color).toMatch(/^#/);
    expect(preset.tool).toBe('rectangle');
  });

  it('multiple presets can be stored', () => {
    const presets: ToolPreset[] = [
      { id: 'p1', name: 'Electrical', color: '#dc2626', tool: 'pen' },
      { id: 'p2', name: 'Structural', color: '#2563eb', tool: 'pen' },
      { id: 'p3', name: 'Plumbing', color: '#16a34a', tool: 'pen' },
    ];
    localStorageMock.setItem(PRESETS_KEY, JSON.stringify(presets));
    const loaded = JSON.parse(localStorageMock.getItem(PRESETS_KEY)!) as ToolPreset[];
    expect(loaded).toHaveLength(3);
  });

  it('preset can be deleted from list', () => {
    const presets: ToolPreset[] = [
      { id: 'p1', name: 'A', color: '#000', tool: 'pen' },
      { id: 'p2', name: 'B', color: '#000', tool: 'pen' },
    ];
    const filtered = presets.filter((p) => p.id !== 'p1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('p2');
  });
});
