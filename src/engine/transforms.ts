import type { Annotation, AnchorPosition, Point } from '../types';
import { clamp01, pointsBoundingBox } from './utils';

function movePoint(p: Point, dx: number, dy: number): Point {
  return { x: clamp01(p.x + dx), y: clamp01(p.y + dy) };
}

export function moveAnnotation(ann: Annotation, dx: number, dy: number): Annotation {
  switch (ann.type) {
    case 'pen':
    case 'polygon':
    case 'area':
    case 'polyline':
      return { ...ann, points: ann.points.map(p => movePoint(p, dx, dy)) };
    case 'rectangle':
    case 'highlight':
    case 'text':
    case 'cloud':
    case 'stamp':
    case 'ellipse':
    case 'hyperlink':
      return { ...ann, x: clamp01(ann.x + dx), y: clamp01(ann.y + dy) };
    case 'arrow':
    case 'measurement':
    case 'dimension':
      return { ...ann, start: movePoint(ann.start, dx, dy), end: movePoint(ann.end, dx, dy) };
    case 'callout':
      return { ...ann, box: { ...ann.box, x: clamp01(ann.box.x + dx), y: clamp01(ann.box.y + dy) }, leaderTarget: movePoint(ann.leaderTarget, dx, dy), knee: movePoint(ann.knee, dx, dy) };
    case 'angle':
      return { ...ann, vertex: movePoint(ann.vertex, dx, dy), ray1: movePoint(ann.ray1, dx, dy), ray2: movePoint(ann.ray2, dx, dy) };
    case 'count':
      return { ...ann, x: clamp01(ann.x + dx), y: clamp01(ann.y + dy) };
    default:
      return ann;
  }
}

function resizeRect(
  x: number, y: number, width: number, height: number,
  anchor: AnchorPosition, dx: number, dy: number
): { x: number; y: number; width: number; height: number } {
  let nx = x, ny = y, nw = width, nh = height;

  switch (anchor) {
    case 'nw': nx += dx; ny += dy; nw -= dx; nh -= dy; break;
    case 'n':  ny += dy; nh -= dy; break;
    case 'ne': nw += dx; ny += dy; nh -= dy; break;
    case 'e':  nw += dx; break;
    case 'se': nw += dx; nh += dy; break;
    case 's':  nh += dy; break;
    case 'sw': nx += dx; nw -= dx; nh += dy; break;
    case 'w':  nx += dx; nw -= dx; break;
  }

  nw = Math.max(nw, 0.01);
  nh = Math.max(nh, 0.01);
  nx = clamp01(nx);
  ny = clamp01(ny);

  return { x: nx, y: ny, width: nw, height: nh };
}

function resizePoints(points: Point[], anchor: AnchorPosition, dx: number, dy: number): Point[] {
  const bb = pointsBoundingBox(points);
  const oldW = bb.maxX - bb.minX || 0.01;
  const oldH = bb.maxY - bb.minY || 0.01;

  const rect = resizeRect(bb.minX, bb.minY, oldW, oldH, anchor, dx, dy);

  return points.map(p => ({
    x: clamp01(rect.x + ((p.x - bb.minX) / oldW) * rect.width),
    y: clamp01(rect.y + ((p.y - bb.minY) / oldH) * rect.height),
  }));
}

export function resizeAnnotation(ann: Annotation, anchor: AnchorPosition, dx: number, dy: number): Annotation {
  switch (ann.type) {
    case 'rectangle':
    case 'highlight':
    case 'cloud':
    case 'stamp':
    case 'ellipse':
    case 'hyperlink':
      return { ...ann, ...resizeRect(ann.x, ann.y, ann.width, ann.height, anchor, dx, dy) };
    case 'pen':
    case 'polygon':
    case 'area':
    case 'polyline':
      return { ...ann, points: resizePoints(ann.points, anchor, dx, dy) };
    case 'arrow':
    case 'measurement':
    case 'dimension': {
      if (anchor === 'nw' || anchor === 'w' || anchor === 'sw') {
        return { ...ann, start: movePoint(ann.start, dx, dy) };
      }
      return { ...ann, end: movePoint(ann.end, dx, dy) };
    }
    case 'callout':
      return { ...ann, box: resizeRect(ann.box.x, ann.box.y, ann.box.width, ann.box.height, anchor, dx, dy) };
    case 'text':
    case 'count':
      return ann;
    case 'angle':
      return { ...ann, vertex: movePoint(ann.vertex, dx, dy), ray1: movePoint(ann.ray1, dx, dy), ray2: movePoint(ann.ray2, dx, dy) };
    default:
      return ann;
  }
}

export function bringToFront(_ann: Annotation, allAnnotations: Annotation[]): number {
  const maxZ = allAnnotations.reduce((m, a) => Math.max(m, a.zIndex), 0);
  return maxZ + 1;
}

export function sendToBack(_ann: Annotation, allAnnotations: Annotation[]): number {
  const minZ = allAnnotations.reduce((m, a) => Math.min(m, a.zIndex), Infinity);
  return minZ - 1;
}

export function bringForward(ann: Annotation, allAnnotations: Annotation[]): number {
  const sorted = [...allAnnotations].sort((a, b) => a.zIndex - b.zIndex);
  const idx = sorted.findIndex(a => a.id === ann.id);
  if (idx < 0 || idx >= sorted.length - 1) return ann.zIndex;
  return sorted[idx + 1].zIndex;
}

export function sendBackward(ann: Annotation, allAnnotations: Annotation[]): number {
  const sorted = [...allAnnotations].sort((a, b) => a.zIndex - b.zIndex);
  const idx = sorted.findIndex(a => a.id === ann.id);
  if (idx <= 0) return ann.zIndex;
  return sorted[idx - 1].zIndex;
}

export function rotateAnnotation(ann: Annotation, angle: number): Annotation {
  return { ...ann, rotation: angle } as Annotation;
}
