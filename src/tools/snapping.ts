import type { Annotation, Point } from '../types';
import { boundingBox } from '../engine/hitTest';

export function constrainTo45(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: start.x + dist * Math.cos(snapped), y: start.y + dist * Math.sin(snapped) };
}

export type SnapGuide = {
  axis: 'x' | 'y';
  position: number;
};

export type SnapResult = {
  snappedPoint: Point;
  guides: SnapGuide[];
};

export function computeSnap(
  point: Point,
  movingIds: Set<string>,
  annotations: Annotation[],
  tolerance: number = 0.01,
): SnapResult {
  const guides: SnapGuide[] = [];
  let sx = point.x;
  let sy = point.y;

  const targets = annotations.filter((a) => !movingIds.has(a.id));

  for (const ann of targets) {
    const bb = boundingBox(ann);

    for (const val of [bb.x, bb.x + bb.width, bb.x + bb.width / 2]) {
      if (Math.abs(point.x - val) < tolerance) {
        sx = val;
        guides.push({ axis: 'x', position: val });
      }
    }

    for (const val of [bb.y, bb.y + bb.height, bb.y + bb.height / 2]) {
      if (Math.abs(point.y - val) < tolerance) {
        sy = val;
        guides.push({ axis: 'y', position: val });
      }
    }
  }

  return { snappedPoint: { x: sx, y: sy }, guides };
}
