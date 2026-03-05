/**
 * Canvas rendering optimization utilities.
 *
 * Integration with App.tsx:
 * - createRenderCache(): Cache rendered page bitmaps to avoid re-rendering unchanged pages.
 *   Key format: `${fingerprint}-${page}-${zoom}`. Instantiate once at app level.
 * - batchCanvasOperations(): Wrap multiple canvas draw calls in a single save/restore pair.
 * - shouldRerender(): Compare annotation arrays to skip unnecessary canvas redraws.
 *   Use before re-rendering annotation overlays on a page.
 * - debounceRAF(): Wrap pointer-move handlers to throttle to animation frames.
 *
 * The QA agent wires these into App.tsx's rendering pipeline.
 */

import type { Annotation } from '../types';

// ---------- LRU Render Cache ----------

export type RenderCache = {
  get(key: string): ImageBitmap | undefined;
  set(key: string, bitmap: ImageBitmap): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  readonly size: number;
};

export function createRenderCache(maxSize: number = 50): RenderCache {
  const cache = new Map<string, ImageBitmap>();

  function evictOldest(): void {
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        const bitmap = cache.get(firstKey);
        bitmap?.close();
        cache.delete(firstKey);
      }
    }
  }

  return {
    get(key: string): ImageBitmap | undefined {
      const bitmap = cache.get(key);
      if (bitmap !== undefined) {
        // Move to end (most recently used)
        cache.delete(key);
        cache.set(key, bitmap);
      }
      return bitmap;
    },

    set(key: string, bitmap: ImageBitmap): void {
      if (cache.has(key)) {
        const old = cache.get(key);
        old?.close();
        cache.delete(key);
      } else {
        evictOldest();
      }
      cache.set(key, bitmap);
    },

    has(key: string): boolean {
      return cache.has(key);
    },

    delete(key: string): boolean {
      const bitmap = cache.get(key);
      bitmap?.close();
      return cache.delete(key);
    },

    clear(): void {
      for (const bitmap of cache.values()) {
        bitmap.close();
      }
      cache.clear();
    },

    get size(): number {
      return cache.size;
    },
  };
}

// ---------- Batch Canvas Operations ----------

export function batchCanvasOperations(
  ctx: CanvasRenderingContext2D,
  ops: Array<() => void>,
): void {
  ctx.save();
  try {
    for (const op of ops) {
      op();
    }
  } finally {
    ctx.restore();
  }
}

// ---------- Should Rerender ----------

/**
 * Shallow compare annotations arrays to skip unnecessary redraws.
 * Returns true if re-render is needed.
 */
export function shouldRerender(
  prev: Annotation[],
  next: Annotation[],
): boolean {
  if (prev === next) return false;
  if (prev.length !== next.length) return true;

  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return true;
  }

  return false;
}

// ---------- RAF Debounce ----------

/**
 * requestAnimationFrame-based debounce for smooth pointer events.
 * Only the last call within a frame gets executed.
 */
export function debounceRAF<T extends (...args: never[]) => void>(fn: T): T & { cancel(): void } {
  let frameId: number | null = null;

  const debounced = ((...args: never[]) => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(() => {
      frameId = null;
      fn(...args);
    });
  }) as T & { cancel(): void };

  debounced.cancel = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  return debounced;
}
