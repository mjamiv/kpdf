import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { normalizeRect } from '../engine/utils';

type EllipseDraft = {
  toolType: 'ellipse';
  start: Point;
  end: Point;
  shiftKey: boolean;
};

export function isEllipseDraft(draft: unknown): draft is EllipseDraft {
  return draft !== null && typeof draft === 'object' && (draft as EllipseDraft).toolType === 'ellipse';
}

const THICKNESS = 0.0025;

function constrainToCircle(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: start.x + size * Math.sign(dx), y: start.y + size * Math.sign(dy) };
}

const ellipseTool: ToolBehavior = {
  name: 'ellipse',
  label: 'Ellipse',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'ellipse', start: e.point, end: e.point, shiftKey: e.shiftKey } as EllipseDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isEllipseDraft(prev)) return prev;
      const end = e.shiftKey ? constrainToCircle(prev.start, e.point) : e.point;
      return { ...prev, end, shiftKey: e.shiftKey };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isEllipseDraft(draft)) { ctx.setDraft(null); return; }

    const end = draft.shiftKey ? constrainToCircle(draft.start, draft.end) : draft.end;
    const rect = normalizeRect(draft.start, end);
    if (rect.width < 0.001 || rect.height < 0.001) { ctx.setDraft(null); return; }

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
        type: 'ellipse',
        ...rect,
        thickness: THICKNESS,
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isEllipseDraft(draft)) return;
    const end = draft.shiftKey ? constrainToCircle(draft.start, draft.end) : draft.end;
    const rect = normalizeRect(draft.start, end);
    const cx = (rect.x + rect.width / 2) * w;
    const cy = (rect.y + rect.height / 2) * h;
    const rx = (rect.width / 2) * w;
    const ry = (rect.height / 2) * h;

    if (rx < 1 || ry < 1) return;

    ctx2d.beginPath();
    ctx2d.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx2d.strokeStyle = '#111827';
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);
    ctx2d.stroke();
  },
};

registerTool(ellipseTool);
export default ellipseTool;
