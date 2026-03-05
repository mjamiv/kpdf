import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type DimensionDraft = {
  toolType: 'dimension';
  start: Point;
  end: Point;
  color: string;
};

export function isDimensionDraft(draft: unknown): draft is DimensionDraft {
  return draft !== null && typeof draft === 'object' && (draft as DimensionDraft).toolType === 'dimension';
}

const THICKNESS = 0.0025;
const OFFSET = 0.015;
const TICK_SIZE = 0.008;

function offsetLine(start: Point, end: Point, offset: number): { s: Point; e: Point } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { s: start, e: end };
  const nx = -dy / len * offset;
  const ny = dx / len * offset;
  return {
    s: { x: start.x + nx, y: start.y + ny },
    e: { x: end.x + nx, y: end.y + ny },
  };
}

function drawDimensionLine(
  ctx2d: CanvasRenderingContext2D,
  start: Point, end: Point,
  offset: number, tickSize: number,
  w: number, h: number,
  color: string, thickness: number,
  label: string,
) {
  const { s, e } = offsetLine(start, end, offset);
  const sx = s.x * w, sy = s.y * h;
  const ex = e.x * w, ey = e.y * h;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const nx = -dy / len;
  const ny = dx / len;

  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = Math.max(thickness * w, 1.5);

  // Main dimension line
  ctx2d.beginPath();
  ctx2d.moveTo(sx, sy);
  ctx2d.lineTo(ex, ey);
  ctx2d.stroke();

  // Tick marks at endpoints (perpendicular)
  const ts = tickSize * w;
  ctx2d.beginPath();
  ctx2d.moveTo(sx - nx * ts, sy - ny * ts);
  ctx2d.lineTo(sx + nx * ts, sy + ny * ts);
  ctx2d.stroke();

  ctx2d.beginPath();
  ctx2d.moveTo(ex - nx * ts, ey - ny * ts);
  ctx2d.lineTo(ex + nx * ts, ey + ny * ts);
  ctx2d.stroke();

  // Extension lines from actual points to offset line
  ctx2d.save();
  ctx2d.setLineDash([2, 2]);
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.moveTo(start.x * w, start.y * h);
  ctx2d.lineTo(sx, sy);
  ctx2d.stroke();
  ctx2d.beginPath();
  ctx2d.moveTo(end.x * w, end.y * h);
  ctx2d.lineTo(ex, ey);
  ctx2d.stroke();
  ctx2d.restore();

  // Label at center
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  ctx2d.font = '12px sans-serif';
  ctx2d.fillStyle = color;
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'bottom';
  ctx2d.fillText(label, mx, my - 4);
  ctx2d.textAlign = 'start';
  ctx2d.textBaseline = 'alphabetic';
}

const dimensionTool: ToolBehavior = {
  name: 'dimension',
  label: 'Dimension',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'dimension', start: e.point, end: e.point, color: ctx.color } as DimensionDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isDimensionDraft(prev)) return prev;
      return { ...prev, end: e.point };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isDimensionDraft(draft)) { ctx.setDraft(null); return; }

    const dx = draft.end.x - draft.start.x;
    const dy = draft.end.y - draft.start.y;
    if (Math.sqrt(dx * dx + dy * dy) < 0.001) { ctx.setDraft(null); return; }

    const timestamp = new Date().toISOString();
    ctx.dispatch({
      type: 'ADD_ANNOTATION',
      page: ctx.page,
      annotation: {
        id: ctx.randomId(),
        zIndex: ctx.nextZIndex(),
        color: ctx.color,
        author: ctx.author,
        createdAt: timestamp,
        updatedAt: timestamp,
        locked: false,
        type: 'dimension',
        start: draft.start,
        end: draft.end,
        offset: OFFSET,
        thickness: THICKNESS,
        scale: ctx.pageScale ? ctx.pageScale.realDistance / ctx.pageScale.pixelDistance : 1,
        unit: ctx.pageScale ? ctx.pageScale.unit : 'px',
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isDimensionDraft(draft)) return;

    const dx = draft.end.x - draft.start.x;
    const dy = draft.end.y - draft.start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const label = `${dist.toFixed(3)} px`;

    drawDimensionLine(ctx2d, draft.start, draft.end, OFFSET, TICK_SIZE, w, h, draft.color || '#111827', THICKNESS, label);
  },
};

registerTool(dimensionTool);
export default dimensionTool;
