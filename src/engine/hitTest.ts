import type { Point, Annotation } from '../types';
import { pointsBoundingBox } from './utils';

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
    case 'pen':
    case 'polygon':
    case 'area':
    case 'polyline': {
      if (annotation.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      const { minX, minY, maxX, maxY } = pointsBoundingBox(annotation.points);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'rectangle':
    case 'highlight':
    case 'cloud':
    case 'stamp':
    case 'ellipse':
    case 'hyperlink':
      return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
    case 'text': {
      const h = annotation.fontSize * 1.2;
      const w = annotation.text.length * annotation.fontSize * 0.6;
      return { x: annotation.x, y: annotation.y - h, width: w, height: h };
    }
    case 'arrow':
    case 'measurement':
    case 'dimension': {
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
    case 'angle': {
      const pts = [annotation.vertex, annotation.ray1, annotation.ray2];
      const { minX, minY, maxX, maxY } = pointsBoundingBox(pts);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'count':
      return { x: annotation.x - annotation.radius, y: annotation.y - annotation.radius, width: annotation.radius * 2, height: annotation.radius * 2 };
  }
}

function pointInRect(point: Point, x: number, y: number, width: number, height: number, tolerance: number): boolean {
  return (
    point.x >= x - tolerance &&
    point.x <= x + width + tolerance &&
    point.y >= y - tolerance &&
    point.y <= y + height + tolerance
  );
}

function pointInEllipse(point: Point, cx: number, cy: number, rx: number, ry: number, tolerance: number): boolean {
  const dx = point.x - cx;
  const dy = point.y - cy;
  const v = (dx * dx) / ((rx + tolerance) * (rx + tolerance)) + (dy * dy) / ((ry + tolerance) * (ry + tolerance));
  return v <= 1;
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
    case 'cloud':
    case 'stamp':
    case 'hyperlink':
      return pointInRect(point, annotation.x, annotation.y, annotation.width, annotation.height, tolerance);
    case 'ellipse': {
      const cx = annotation.x + annotation.width / 2;
      const cy = annotation.y + annotation.height / 2;
      return pointInEllipse(point, cx, cy, annotation.width / 2, annotation.height / 2, tolerance);
    }
    case 'text': {
      const bb = boundingBox(annotation);
      return pointInRect(point, bb.x, bb.y, bb.width, bb.height, tolerance);
    }
    case 'arrow':
    case 'measurement':
    case 'dimension': {
      const hitDist = Math.max(annotation.thickness * 3, tolerance);
      return distanceToLineSegment(point, annotation.start, annotation.end) < hitDist;
    }
    case 'callout': {
      const box = annotation.box;
      if (pointInRect(point, box.x, box.y, box.width, box.height, tolerance)) return true;
      const boxCenter: Point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      return distanceToLineSegment(point, boxCenter, annotation.leaderTarget) < tolerance;
    }
    case 'polygon':
    case 'area': {
      if (annotation.points.length < 2) return false;
      if (annotation.points.length >= 3 && pointInPolygon(point, annotation.points)) return true;
      for (let i = 0; i < annotation.points.length - 1; i++) {
        if (distanceToLineSegment(point, annotation.points[i], annotation.points[i + 1]) < tolerance) {
          return true;
        }
      }
      if (annotation.points.length >= 3) {
        if (distanceToLineSegment(point, annotation.points[annotation.points.length - 1], annotation.points[0]) < tolerance) {
          return true;
        }
      }
      return false;
    }
    case 'polyline': {
      if (annotation.points.length < 2) return false;
      for (let i = 0; i < annotation.points.length - 1; i++) {
        if (distanceToLineSegment(point, annotation.points[i], annotation.points[i + 1]) < tolerance) {
          return true;
        }
      }
      return false;
    }
    case 'angle': {
      if (distanceToLineSegment(point, annotation.vertex, annotation.ray1) < tolerance) return true;
      if (distanceToLineSegment(point, annotation.vertex, annotation.ray2) < tolerance) return true;
      return false;
    }
    case 'count': {
      const dx = point.x - annotation.x;
      const dy = point.y - annotation.y;
      return Math.sqrt(dx * dx + dy * dy) < annotation.radius + tolerance;
    }
    default:
      return false;
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
