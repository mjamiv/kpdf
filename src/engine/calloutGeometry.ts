import type { Point } from '../types';

/**
 * Compute the point on the box edge nearest to the given external point.
 * This is where the leader line connects to the text box.
 */
export function computeBoxEdgeAnchor(
  from: Point,
  box: { x: number; y: number; width: number; height: number },
): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const dx = from.x - cx;
  const dy = from.y - cy;

  // Degenerate: point is at box center
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return { x: box.x, y: cy };
  }

  const halfW = box.width / 2;
  const halfH = box.height / 2;

  // Find intersection with box edges using ray from center toward `from`
  let tMin = Infinity;
  let hitX = cx;
  let hitY = cy;

  // Right edge
  if (dx > 0) {
    const t = halfW / dx;
    const iy = dy * t;
    if (Math.abs(iy) <= halfH && t < tMin) {
      tMin = t; hitX = cx + halfW; hitY = cy + iy;
    }
  }
  // Left edge
  if (dx < 0) {
    const t = -halfW / dx;
    const iy = dy * t;
    if (Math.abs(iy) <= halfH && t < tMin) {
      tMin = t; hitX = cx - halfW; hitY = cy + iy;
    }
  }
  // Bottom edge
  if (dy > 0) {
    const t = halfH / dy;
    const ix = dx * t;
    if (Math.abs(ix) <= halfW && t < tMin) {
      tMin = t; hitX = cx + ix; hitY = cy + halfH;
    }
  }
  // Top edge
  if (dy < 0) {
    const t = -halfH / dy;
    const ix = dx * t;
    if (Math.abs(ix) <= halfW && t < tMin) {
      tMin = t; hitX = cx + ix; hitY = cy - halfH;
    }
  }

  return { x: hitX, y: hitY };
}

/**
 * Ensure backward compatibility: if a callout annotation lacks a `knee`,
 * generate one automatically from the anchor and box position.
 */
export function ensureKnee(
  leaderTarget: Point,
  box: { x: number; y: number; width: number; height: number },
  knee?: Point,
): Point {
  if (knee) return knee;

  // Auto-generate: place knee at same x as box left edge, same y as anchor
  // This creates a clean L-shaped leader
  const boxEdge = computeBoxEdgeAnchor(leaderTarget, box);
  return { x: boxEdge.x, y: leaderTarget.y };
}
