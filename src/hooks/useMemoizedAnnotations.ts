/**
 * Hook that memoizes annotation arrays per page to avoid unnecessary re-renders.
 *
 * Integration with App.tsx:
 * - Replace direct access to `state.annotationsByPage[page]` with this hook
 *   to get stable references when annotations haven't changed.
 * - Example:
 *     const pageAnnotations = useMemoizedAnnotations(state.annotationsByPage, pageNum);
 *   This returns the same array reference if annotations haven't changed
 *   (compared by id + updatedAt), preventing unnecessary canvas redraws.
 *
 * The QA agent wires this into App.tsx's page rendering loop.
 */

import { useMemo } from 'react';
import type { Annotation, AnnotationsByPage } from '../types';

/**
 * Shallow compare annotations by id + updatedAt.
 * Returns true if the arrays are considered equal.
 */
function annotationsEqual(prev: Annotation[], next: Annotation[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id) return false;
    if (prev[i].updatedAt !== next[i].updatedAt) return false;
  }

  return true;
}

/**
 * Build a stable cache key from the annotation array's ids and updatedAt values.
 * useMemo will recompute only when this key changes.
 */
function annotationsCacheKey(annotations: Annotation[]): string {
  if (annotations.length === 0) return '';
  return annotations.map((a) => `${a.id}:${a.updatedAt}`).join(',');
}

export function useMemoizedAnnotations(
  annotationsByPage: AnnotationsByPage,
  page: number,
): Annotation[] {
  const current = annotationsByPage[page] ?? [];
  const cacheKey = annotationsCacheKey(current);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => current, [cacheKey]);
}

/**
 * Pure function version for use in non-hook contexts (e.g., tests).
 */
export { annotationsEqual };
