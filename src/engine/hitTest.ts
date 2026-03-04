import type { Point, Annotation } from '../types.ts';

export function distanceToLineSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((point.x - a.x) ** 2 + (point.y - a.y) ** 2);
  }

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

export function pointInPolygon(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) return false;

  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    if ((yi > point.y) !== (yj > point.y) &&
        point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function boundingBox(annotation: Annotation): { x: number; y: number; width: number; height: number } {
  switch (annotation.type) {
    case 'pen': {
      if (annotation.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of annotation.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'rectangle':
    case 'highlight':
      return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
    case 'text': {
      const h = annotation.fontSize * 1.2;
      const w = annotation.text.length * annotation.fontSize * 0.6;
      return { x: annotation.x, y: annotation.y - h, width: w, height: h };
    }
    case 'arrow':
    case 'measurement': {
      const minX = Math.min(annotation.start.x, annotation.end.x);
      const minY = Math.min(annotation.start.y, annotation.end.y);
      const maxX = Math.max(annotation.start.x, annotation.end.x);
      const maxY = Math.max(annotation.start.y, annotation.end.y);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'callout': {
      const bx = annotation.box.x;
      const by = annotation.box.y;
      const bx2 = bx + annotation.box.width;
      const by2 = by + annotation.box.height;
      const minX = Math.min(bx, annotation.leaderTarget.x);
      const minY = Math.min(by, annotation.leaderTarget.y);
      const maxX = Math.max(bx2, annotation.leaderTarget.x);
      const maxY = Math.max(by2, annotation.leaderTarget.y);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'cloud':
    case 'stamp':
      return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
    case 'polygon': {
      if (annotation.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of annotation.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
}

export function pointInAnnotation(point: Point, annotation: Annotation, tolerance: number = 0.01): boolean {
  switch (annotation.type) {
    case 'pen': {
      if (annotation.points.length === 0) return false;
      const hitDist = Math.max(annotation.thickness * 3, tolerance);
      if (annotation.points.length === 1) {
        return distanceToLineSegment(point, annotation.points[0], annotation.points[0]) < hitDist;
      }
      for (let i = 0; i < annotation.points.length - 1; i++) {
        if (distanceToLineSegment(point, annotation.points[i], annotation.points[i + 1]) < hitDist) {
          return true;
        }
      }
      return false;
    }
    case 'rectangle':
    case 'highlight':
      return (
        point.x >= annotation.x - tolerance &&
        point.x <= annotation.x + annotation.width + tolerance &&
        point.y >= annotation.y - tolerance &&
        point.y <= annotation.y + annotation.height + tolerance
      );
    case 'text': {
      const bb = boundingBox(annotation);
      return (
        point.x >= bb.x - tolerance &&
        point.x <= bb.x + bb.width + tolerance &&
        point.y >= bb.y - tolerance &&
        point.y <= bb.y + bb.height + tolerance
      );
    }
    case 'arrow':
    case 'measurement': {
      const hitDist = Math.max(annotation.thickness * 3, tolerance);
      return distanceToLineSegment(point, annotation.start, annotation.end) < hitDist;
    }
    case 'callout': {
      const box = annotation.box;
      const inBox =
        point.x >= box.x - tolerance &&
        point.x <= box.x + box.width + tolerance &&
        point.y >= box.y - tolerance &&
        point.y <= box.y + box.height + tolerance;
      if (inBox) return true;
      const boxCenter: Point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      return distanceToLineSegment(point, boxCenter, annotation.leaderTarget) < tolerance;
    }
    case 'cloud':
    case 'stamp':
      return (
        point.x >= annotation.x - tolerance &&
        point.x <= annotation.x + annotation.width + tolerance &&
        point.y >= annotation.y - tolerance &&
        point.y <= annotation.y + annotation.height + tolerance
      );
    case 'polygon': {
      if (annotation.points.length < 2) return false;
      if (annotation.points.length >= 3 && pointInPolygon(point, annotation.points)) return true;
      for (let i = 0; i < annotation.points.length - 1; i++) {
        if (distanceToLineSegment(point, annotation.points[i], annotation.points[i + 1]) < tolerance) {
          return true;
        }
      }
      if (annotation.closed && annotation.points.length >= 3) {
        if (distanceToLineSegment(point, annotation.points[annotation.points.length - 1], annotation.points[0]) < tolerance) {
          return true;
        }
      }
      return false;
    }
  }
}

export function hitTestAnnotations(point: Point, annotations: Annotation[], tolerance?: number): Annotation | null {
  const sorted = [...annotations].sort((a, b) => b.zIndex - a.zIndex);
  for (const ann of sorted) {
    if (pointInAnnotation(point, ann, tolerance)) {
      return ann;
    }
  }
  return null;
}
