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

/**
 * Draw a scalloped (cloud-like) rectangle border on a canvas 2D context.
 * All parameters are in pixel coordinates.
 */
export function drawCloudShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const perim = 2 * (w + h);
  const targetDiameter = Math.max(10, Math.min(perim / 24, 30));

  const topArcs = Math.max(Math.round(w / targetDiameter), 1);
  const rightArcs = Math.max(Math.round(h / targetDiameter), 1);
  const topStep = w / topArcs;
  const rightStep = h / rightArcs;

  ctx.beginPath();

  // Top edge (left to right): arcs bulge outward (upward)
  for (let i = 0; i < topArcs; i++) {
    const cx = x + topStep * i + topStep / 2;
    ctx.arc(cx, y, topStep / 2, Math.PI, 0, false);
  }

  // Right edge (top to bottom): arcs bulge outward (rightward)
  for (let i = 0; i < rightArcs; i++) {
    const cy = y + rightStep * i + rightStep / 2;
    ctx.arc(x + w, cy, rightStep / 2, -Math.PI / 2, Math.PI / 2, false);
  }

  // Bottom edge (right to left): arcs bulge outward (downward)
  for (let i = topArcs - 1; i >= 0; i--) {
    const cx = x + topStep * i + topStep / 2;
    ctx.arc(cx, y + h, topStep / 2, 0, Math.PI, false);
  }

  // Left edge (bottom to top): arcs bulge outward (leftward)
  for (let i = rightArcs - 1; i >= 0; i--) {
    const cy = y + rightStep * i + rightStep / 2;
    ctx.arc(x, cy, rightStep / 2, Math.PI / 2, -Math.PI / 2, false);
  }

  ctx.closePath();
  ctx.stroke();
}
