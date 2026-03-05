import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRenderCache,
  batchCanvasOperations,
  shouldRerender,
  debounceRAF,
} from './renderOptimizations';
import type { Annotation } from '../types';

// Mock ImageBitmap since it's not available in Node
function mockImageBitmap(id: string): ImageBitmap {
  return {
    width: 100,
    height: 100,
    close: vi.fn(),
    _id: id,
  } as unknown as ImageBitmap;
}

function makeAnnotation(id: string, updatedAt?: string): Annotation {
  return {
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    thickness: 2,
    zIndex: 0,
    color: '#ff0000',
    author: 'test',
    createdAt: '2024-01-01',
    updatedAt: updatedAt ?? '2024-01-01',
    locked: false,
  } as Annotation;
}

describe('createRenderCache', () => {
  it('stores and retrieves bitmaps', () => {
    const cache = createRenderCache(10);
    const bitmap = mockImageBitmap('1');
    cache.set('key1', bitmap);
    expect(cache.get('key1')).toBe(bitmap);
  });

  it('returns undefined for missing keys', () => {
    const cache = createRenderCache(10);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('reports correct size', () => {
    const cache = createRenderCache(10);
    expect(cache.size).toBe(0);
    cache.set('a', mockImageBitmap('a'));
    expect(cache.size).toBe(1);
    cache.set('b', mockImageBitmap('b'));
    expect(cache.size).toBe(2);
  });

  it('evicts oldest entry when max size exceeded', () => {
    const cache = createRenderCache(2);
    const b1 = mockImageBitmap('1');
    const b2 = mockImageBitmap('2');
    const b3 = mockImageBitmap('3');

    cache.set('k1', b1);
    cache.set('k2', b2);
    cache.set('k3', b3);

    expect(cache.size).toBe(2);
    expect(cache.get('k1')).toBeUndefined();
    expect(b1.close).toHaveBeenCalled();
    expect(cache.get('k2')).toBeDefined();
    expect(cache.get('k3')).toBeDefined();
  });

  it('LRU: accessing an item makes it most recently used', () => {
    const cache = createRenderCache(2);
    const b1 = mockImageBitmap('1');
    const b2 = mockImageBitmap('2');
    const b3 = mockImageBitmap('3');

    cache.set('k1', b1);
    cache.set('k2', b2);

    // Access k1 to make it recently used
    cache.get('k1');

    // Now k2 is least recently used
    cache.set('k3', b3);

    expect(cache.get('k1')).toBeDefined();
    expect(cache.get('k2')).toBeUndefined();
    expect(cache.get('k3')).toBeDefined();
  });

  it('has() checks existence', () => {
    const cache = createRenderCache(10);
    cache.set('k1', mockImageBitmap('1'));
    expect(cache.has('k1')).toBe(true);
    expect(cache.has('k2')).toBe(false);
  });

  it('delete() removes and closes bitmap', () => {
    const cache = createRenderCache(10);
    const bitmap = mockImageBitmap('1');
    cache.set('k1', bitmap);
    cache.delete('k1');
    expect(cache.size).toBe(0);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('clear() removes all and closes bitmaps', () => {
    const cache = createRenderCache(10);
    const b1 = mockImageBitmap('1');
    const b2 = mockImageBitmap('2');
    cache.set('k1', b1);
    cache.set('k2', b2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(b1.close).toHaveBeenCalled();
    expect(b2.close).toHaveBeenCalled();
  });

  it('replacing an existing key closes old bitmap', () => {
    const cache = createRenderCache(10);
    const old = mockImageBitmap('old');
    const replacement = mockImageBitmap('new');
    cache.set('k1', old);
    cache.set('k1', replacement);
    expect(cache.get('k1')).toBe(replacement);
    expect(old.close).toHaveBeenCalled();
    expect(cache.size).toBe(1);
  });

  it('uses default maxSize of 50', () => {
    const cache = createRenderCache();
    for (let i = 0; i < 55; i++) {
      cache.set(`k${i}`, mockImageBitmap(`${i}`));
    }
    expect(cache.size).toBe(50);
  });
});

describe('batchCanvasOperations', () => {
  it('calls save, all ops, then restore', () => {
    const callOrder: string[] = [];
    const ctx = {
      save: vi.fn(() => callOrder.push('save')),
      restore: vi.fn(() => callOrder.push('restore')),
    } as unknown as CanvasRenderingContext2D;

    const op1 = vi.fn(() => callOrder.push('op1'));
    const op2 = vi.fn(() => callOrder.push('op2'));

    batchCanvasOperations(ctx, [op1, op2]);

    expect(callOrder).toEqual(['save', 'op1', 'op2', 'restore']);
  });

  it('calls restore even if an operation throws', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const failing = () => {
      throw new Error('test error');
    };

    expect(() => batchCanvasOperations(ctx, [failing])).toThrow('test error');
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('handles empty ops array', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    batchCanvasOperations(ctx, []);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

describe('shouldRerender', () => {
  it('returns false for same reference', () => {
    const arr = [makeAnnotation('1')];
    expect(shouldRerender(arr, arr)).toBe(false);
  });

  it('returns true for different lengths', () => {
    const prev = [makeAnnotation('1')];
    const next = [makeAnnotation('1'), makeAnnotation('2')];
    expect(shouldRerender(prev, next)).toBe(true);
  });

  it('returns false for same objects in same order', () => {
    const a1 = makeAnnotation('1');
    const a2 = makeAnnotation('2');
    const prev = [a1, a2];
    const next = [a1, a2];
    expect(shouldRerender(prev, next)).toBe(false);
  });

  it('returns true when an annotation reference changes', () => {
    const a1 = makeAnnotation('1');
    const a1Modified = { ...a1 };
    expect(shouldRerender([a1], [a1Modified])).toBe(true);
  });

  it('returns false for two empty arrays', () => {
    expect(shouldRerender([], [])).toBe(false);
  });

  it('returns true when order changes', () => {
    const a1 = makeAnnotation('1');
    const a2 = makeAnnotation('2');
    expect(shouldRerender([a1, a2], [a2, a1])).toBe(true);
  });
});

describe('debounceRAF', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let rafId = 0;
    const rafCallbacks = new Map<number, FrameRequestCallback>();

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, cb);
      // Simulate next frame
      Promise.resolve().then(() => {
        const callback = rafCallbacks.get(id);
        if (callback) {
          rafCallbacks.delete(id);
          callback(performance.now());
        }
      });
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });
  });

  it('calls the function', async () => {
    const fn = vi.fn();
    const debounced = debounceRAF(fn);
    debounced();
    await vi.runAllTimersAsync();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('only calls with latest args when called multiple times rapidly', async () => {
    const fn = vi.fn();
    const debounced = debounceRAF(fn);
    debounced(1);
    debounced(2);
    debounced(3);
    await vi.runAllTimersAsync();
    // Due to cancelAnimationFrame, only the last call should execute
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('has a cancel method', () => {
    const fn = vi.fn();
    const debounced = debounceRAF(fn);
    expect(typeof debounced.cancel).toBe('function');
  });
});
