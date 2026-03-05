import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { constrainTo45 } from './snapping';

type ArrowDraft = {
  toolType: 'arrow';
  start: Point;
  end: Point;
};

export function isArrowDraft(draft: unknown): draft is ArrowDraft {
  return draft !== null && typeof draft === 'object' && (draft as ArrowDraft).toolType === 'arrow';
}

const THICKNESS = 0.0025;
const HEAD_SIZE = 0.015;

const arrowTool: ToolBehavior = {
  name: 'arrow',
  label: 'Arrow',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'arrow', start: e.point, end: e.point } as ArrowDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isArrowDraft(prev)) return prev;
      const end = e.shiftKey ? constrainTo45(prev.start, e.point) : e.point;
      return { ...prev, end };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isArrowDraft(draft)) { ctx.setDraft(null); return; }

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
        type: 'arrow',
        start: draft.start,
        end: draft.end,
        thickness: THICKNESS,
        headSize: HEAD_SIZE,
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isArrowDraft(draft)) return;

    const sx = draft.start.x * w;
    const sy = draft.start.y * h;
    const ex = draft.end.x * w;
    const ey = draft.end.y * h;

    ctx2d.beginPath();
    ctx2d.moveTo(sx, sy);
    ctx2d.lineTo(ex, ey);
    ctx2d.strokeStyle = '#111827';
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);
    ctx2d.stroke();

    // Draw arrowhead
    const angle = Math.atan2(ey - sy, ex - sx);
    const headLen = HEAD_SIZE * w;
    const a1 = angle + Math.PI + Math.PI / 6;
    const a2 = angle + Math.PI - Math.PI / 6;

    ctx2d.beginPath();
    ctx2d.moveTo(ex + headLen * Math.cos(a1), ey + headLen * Math.sin(a1));
    ctx2d.lineTo(ex, ey);
    ctx2d.lineTo(ex + headLen * Math.cos(a2), ey + headLen * Math.sin(a2));
    ctx2d.stroke();
  },
};

registerTool(arrowTool);
export default arrowTool;
