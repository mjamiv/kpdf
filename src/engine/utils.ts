import type { Annotation, Point } from '../types';

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeRect(start: Point, end: Point): { x: number; y: number; width: number; height: number } {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function nextZIndex(annotations: Annotation[]): number {
  return annotations.reduce((max, annotation) => Math.max(max, annotation.zIndex), 0) + 1;
}

export function sortedAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => a.zIndex - b.zIndex);
}
