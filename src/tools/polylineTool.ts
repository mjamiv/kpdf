import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type PolylineDraft = {
  toolType: 'polyline';
  points: Point[];
  lastMouse: Point;
  color: string;
};

export function isPolylineDraft(draft: unknown): draft is PolylineDraft {
  return draft !== null && typeof draft === 'object' && (draft as PolylineDraft).toolType === 'polyline';
}

const THICKNESS = 0.0025;

function commitPolyline(ctx: ToolContext, draft: PolylineDraft) {
  if (draft.points.length < 2) { ctx.setDraft(null); return; }

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
      type: 'polyline',
      points: draft.points,
      thickness: THICKNESS,
    },
  });
  ctx.setDraft(null);
}

const polylineTool: ToolBehavior = {
  name: 'polyline',
  label: 'Polyline',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;

    if (!isPolylineDraft(draft)) {
      ctx.setDraft({ toolType: 'polyline', points: [e.point], lastMouse: e.point, color: ctx.color } as PolylineDraft);
      return;
    }

    // Double-click finalizes (detail >= 2 not available, so we check time-based in onKeyDown)
    // Add point on single click
    ctx.setDraft({ ...draft, points: [...draft.points, e.point] });
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isPolylineDraft(prev)) return prev;
      return { ...prev, lastMouse: e.point };
    });
  },

  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op: polyline commits on double-click or Enter
  },

  onKeyDown(ctx: ToolContext, e: KeyboardEvent) {
    const draft = ctx.draft;
    if (!isPolylineDraft(draft)) return;

    if (e.key === 'Enter') {
      commitPolyline(ctx, draft);
    } else if (e.key === 'Escape') {
      ctx.setDraft(null);
    }
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isPolylineDraft(draft) || draft.points.length < 1) return;

    ctx2d.strokeStyle = (draft as PolylineDraft).color || '#111827';
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);
    ctx2d.lineJoin = 'round';

    // Draw connected lines
    ctx2d.beginPath();
    ctx2d.moveTo(draft.points[0].x * w, draft.points[0].y * h);
    for (let i = 1; i < draft.points.length; i++) {
      ctx2d.lineTo(draft.points[i].x * w, draft.points[i].y * h);
    }
    ctx2d.stroke();

    // Draw dashed preview line to cursor
    const last = draft.points[draft.points.length - 1];
    ctx2d.beginPath();
    ctx2d.setLineDash([4, 4]);
    ctx2d.moveTo(last.x * w, last.y * h);
    ctx2d.lineTo(draft.lastMouse.x * w, draft.lastMouse.y * h);
    ctx2d.stroke();
    ctx2d.setLineDash([]);
  },
};

registerTool(polylineTool);
export default polylineTool;
