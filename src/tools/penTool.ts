import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type PenDraft = {
  toolType: 'pen';
  points: Point[];
};

export function isPenDraft(draft: unknown): draft is PenDraft {
  return draft !== null && typeof draft === 'object' && (draft as PenDraft).toolType === 'pen';
}

const PEN_THICKNESS = 0.0025;

const penTool: ToolBehavior = {
  name: 'pen',
  label: 'Pen',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'pen', points: [e.point] } as PenDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isPenDraft(prev)) return prev;
      return { ...prev, points: [...prev.points, e.point] };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isPenDraft(draft)) { ctx.setDraft(null); return; }

    if (draft.points.length > 1) {
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
          type: 'pen',
          points: draft.points,
          thickness: PEN_THICKNESS,
        },
      });
    }

    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isPenDraft(draft) || draft.points.length < 2) return;
    ctx2d.beginPath();
    ctx2d.moveTo(draft.points[0].x * w, draft.points[0].y * h);
    for (let i = 1; i < draft.points.length; i++) {
      ctx2d.lineTo(draft.points[i].x * w, draft.points[i].y * h);
    }
    ctx2d.strokeStyle = '#111827';
    ctx2d.lineJoin = 'round';
    ctx2d.lineCap = 'round';
    ctx2d.lineWidth = Math.max(PEN_THICKNESS * w, 1.5);
    ctx2d.stroke();
  },
};

registerTool(penTool);
export default penTool;
