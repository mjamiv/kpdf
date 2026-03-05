import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWordCountPlugin,
  createAnnotationStatsPlugin,
  createAutoSavePlugin,
} from './builtinPlugins';
import type { PluginAPI } from './pluginApi';
import type { Annotation } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockAPI(overrides: Partial<PluginAPI> = {}): PluginAPI {
  return {
    getAnnotations: vi.fn(() => []),
    addAnnotation: vi.fn(),
    removeAnnotation: vi.fn(),
    getCurrentPage: vi.fn(() => 1),
    navigateToPage: vi.fn(),
    registerTool: vi.fn(),
    registerExportFormat: vi.fn(),
    registerPanel: vi.fn(),
    showNotification: vi.fn(),
    getDocumentInfo: vi.fn(() => ({ fingerprint: 'abc', pageCount: 5, fileName: 'test.pdf' })),
    ...overrides,
  };
}

function makeTextAnnotation(id: string, text: string): Annotation {
  return {
    id,
    zIndex: 1,
    type: 'text',
    x: 0.5,
    y: 0.5,
    text,
    fontSize: 0.02,
    color: '#ff0000',
    author: 'tester',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    locked: false,
  };
}

function makeRectAnnotation(id: string, author = 'tester'): Annotation {
  return {
    id,
    zIndex: 1,
    type: 'rectangle',
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    thickness: 2,
    color: '#00ff00',
    author,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    locked: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wordCountPlugin', () => {
  it('shows word count notification on annotation created', () => {
    const showNotification = vi.fn();
    const annotations = [makeTextAnnotation('a1', 'hello world'), makeTextAnnotation('a2', 'foo')];
    const api = makeMockAPI({
      showNotification,
      getAnnotations: vi.fn(() => annotations),
      getCurrentPage: vi.fn(() => 2),
    });

    const plugin = createWordCountPlugin();
    plugin.onActivate!(api);
    plugin.onAnnotationCreated!(annotations[0], 2);

    expect(showNotification).toHaveBeenCalledWith('Word count (page 2): 3');
  });

  it('shows word count notification on annotation updated', () => {
    const showNotification = vi.fn();
    const annotations = [makeTextAnnotation('a1', 'one two three four')];
    const api = makeMockAPI({
      showNotification,
      getAnnotations: vi.fn(() => annotations),
      getCurrentPage: vi.fn(() => 1),
    });

    const plugin = createWordCountPlugin();
    plugin.onActivate!(api);
    plugin.onAnnotationUpdated!(annotations[0], 1);

    expect(showNotification).toHaveBeenCalledWith('Word count (page 1): 4');
  });

  it('counts 0 words for non-text annotations', () => {
    const showNotification = vi.fn();
    const annotations = [makeRectAnnotation('r1')];
    const api = makeMockAPI({
      showNotification,
      getAnnotations: vi.fn(() => annotations),
    });

    const plugin = createWordCountPlugin();
    plugin.onActivate!(api);
    plugin.onAnnotationCreated!(annotations[0], 1);

    expect(showNotification).toHaveBeenCalledWith('Word count (page 1): 0');
  });

  it('clears api reference on deactivate', () => {
    const showNotification = vi.fn();
    const api = makeMockAPI({ showNotification });

    const plugin = createWordCountPlugin();
    plugin.onActivate!(api);
    plugin.onDeactivate!();

    // After deactivate, hooks should be no-ops
    plugin.onAnnotationCreated!(makeTextAnnotation('a1', 'test'), 1);
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('annotationStatsPlugin', () => {
  it('tracks creation count by type', () => {
    const plugin = createAnnotationStatsPlugin();
    plugin.onActivate!({} as PluginAPI);

    plugin.onAnnotationCreated!(makeTextAnnotation('a1', 'x'), 1);
    plugin.onAnnotationCreated!(makeTextAnnotation('a2', 'y'), 1);
    plugin.onAnnotationCreated!(makeRectAnnotation('r1'), 1);

    const stats = plugin.getStats();
    expect(stats.totalCreated).toBe(3);
    expect(stats.byType['text']).toBe(2);
    expect(stats.byType['rectangle']).toBe(1);
  });

  it('tracks creation count by author', () => {
    const plugin = createAnnotationStatsPlugin();
    plugin.onActivate!({} as PluginAPI);

    plugin.onAnnotationCreated!(makeTextAnnotation('a1', 'x'), 1);
    plugin.onAnnotationCreated!(makeRectAnnotation('r1', 'bob'), 1);

    const stats = plugin.getStats();
    expect(stats.byAuthor['tester']).toBe(1);
    expect(stats.byAuthor['bob']).toBe(1);
  });

  it('resets stats on re-activation', () => {
    const plugin = createAnnotationStatsPlugin();
    plugin.onActivate!({} as PluginAPI);
    plugin.onAnnotationCreated!(makeTextAnnotation('a1', 'x'), 1);

    // Re-activate
    plugin.onActivate!({} as PluginAPI);
    const stats = plugin.getStats();
    expect(stats.totalCreated).toBe(0);
  });

  it('returns a copy of stats (immutable)', () => {
    const plugin = createAnnotationStatsPlugin();
    plugin.onActivate!({} as PluginAPI);
    plugin.onAnnotationCreated!(makeTextAnnotation('a1', 'x'), 1);

    const s1 = plugin.getStats();
    plugin.onAnnotationCreated!(makeTextAnnotation('a2', 'y'), 1);
    const s2 = plugin.getStats();

    expect(s1.totalCreated).toBe(1);
    expect(s2.totalCreated).toBe(2);
  });
});

describe('autoSavePlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends periodic notification', () => {
    const showNotification = vi.fn();
    const api = makeMockAPI({ showNotification });

    const plugin = createAutoSavePlugin(1000);
    plugin.onActivate!(api);

    vi.advanceTimersByTime(1000);
    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith('Auto-save: remember to save your work!', 'info');

    vi.advanceTimersByTime(1000);
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('stops notifications on deactivate', () => {
    const showNotification = vi.fn();
    const api = makeMockAPI({ showNotification });

    const plugin = createAutoSavePlugin(1000);
    plugin.onActivate!(api);
    plugin.onDeactivate!();

    vi.advanceTimersByTime(5000);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('uses default interval of 60s', () => {
    const showNotification = vi.fn();
    const api = makeMockAPI({ showNotification });

    const plugin = createAutoSavePlugin();
    plugin.onActivate!(api);

    vi.advanceTimersByTime(59_999);
    expect(showNotification).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(showNotification).toHaveBeenCalledOnce();
  });
});
