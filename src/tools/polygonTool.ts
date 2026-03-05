import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type PolygonDraft = {
  toolType: 'polygon';
  points: Point[];
  lastMouse: Point;
  color: string;
};

export function isPolygonDraft(draft: unknown): draft is PolygonDraft {
  return draft !== null && typeof draft === 'object' && (draft as PolygonDraft).toolType === 'polygon';
}

const THICKNESS = 0.0025;
const CLOSE_THRESHOLD = 0.015;

const polygonTool: ToolBehavior = {
  name: 'polygon',
  label: 'Polygon',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;

    if (!isPolygonDraft(draft)) {
      // Start new polygon
      ctx.setDraft({ toolType: 'polygon', points: [e.point], lastMouse: e.point, color: ctx.color } as PolygonDraft);
      return;
    }

    // Check if closing the polygon
    const first = draft.points[0];
    const dx = e.point.x - first.x;
    const dy = e.point.y - first.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CLOSE_THRESHOLD && draft.points.length >= 3) {
      // Close polygon
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
          type: 'polygon',
          points: draft.points,
          closed: true,
          thickness: THICKNESS,
        },
      });
      ctx.setDraft(null);
      return;
    }

    // Add point
    ctx.setDraft({ ...draft, points: [...draft.points, e.point] });
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isPolygonDraft(prev)) return prev;
      return { ...prev, lastMouse: e.point };
    });
  },

  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op: polygon commits on close, not on pointer up
  },

  onKeyDown(ctx: ToolContext, e: KeyboardEvent) {
    if (e.key === 'Escape') {
      ctx.setDraft(null);
    }
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isPolygonDraft(draft) || draft.points.length < 1) return;

    ctx2d.strokeStyle = (draft as PolygonDraft).color || '#111827';
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);
    ctx2d.lineJoin = 'round';

    // Draw lines connecting all points
    ctx2d.beginPath();
    ctx2d.moveTo(draft.points[0].x * w, draft.points[0].y * h);
    for (let i = 1; i < draft.points.length; i++) {
      ctx2d.lineTo(draft.points[i].x * w, draft.points[i].y * h);
    }
    ctx2d.stroke();

    // Draw dashed line from last point to mouse position
    const last = draft.points[draft.points.length - 1];
    ctx2d.beginPath();
    ctx2d.setLineDash([4, 4]);
    ctx2d.moveTo(last.x * w, last.y * h);
    ctx2d.lineTo(draft.lastMouse.x * w, draft.lastMouse.y * h);
    ctx2d.stroke();
    ctx2d.setLineDash([]);
  },
};

registerTool(polygonTool);
export default polygonTool;
