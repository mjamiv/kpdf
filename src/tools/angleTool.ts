import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type AngleDraft = {
  toolType: 'angle';
  clicks: Point[];
  lastMouse: Point;
  color: string;
};

export function isAngleDraft(draft: unknown): draft is AngleDraft {
  return draft !== null && typeof draft === 'object' && (draft as AngleDraft).toolType === 'angle';
}

const THICKNESS = 0.0025;

export function computeAngleDeg(vertex: Point, ray1: Point, ray2: Point): number {
  const a1 = Math.atan2(ray1.y - vertex.y, ray1.x - vertex.x);
  const a2 = Math.atan2(ray2.y - vertex.y, ray2.x - vertex.x);
  let diff = Math.abs(a1 - a2) * (180 / Math.PI);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

const angleTool: ToolBehavior = {
  name: 'angle',
  label: 'Angle',
  cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23357a45' stroke-width='1.5'%3E%3Cline x1='12' y1='2' x2='12' y2='22'/%3E%3Cline x1='2' y1='12' x2='22' y2='12'/%3E%3Cline x1='12' y1='6' x2='14' y2='6'/%3E%3Cline x1='12' y1='10' x2='13' y2='10'/%3E%3Cline x1='12' y1='14' x2='13' y2='14'/%3E%3Cline x1='12' y1='18' x2='14' y2='18'/%3E%3C/svg%3E") 12 12, crosshair`,

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;

    if (!isAngleDraft(draft)) {
      ctx.setDraft({ toolType: 'angle', clicks: [e.point], lastMouse: e.point, color: ctx.color } as AngleDraft);
      return;
    }

    if (draft.clicks.length === 1) {
      // Second click: ray1 end
      ctx.setDraft({ ...draft, clicks: [...draft.clicks, e.point] });
      return;
    }

    if (draft.clicks.length === 2) {
      // Third click: ray2 end -> commit
      const vertex = draft.clicks[0];
      const ray1 = draft.clicks[1];
      const ray2 = e.point;

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
          type: 'angle',
          vertex,
          ray1,
          ray2,
          thickness: THICKNESS,
        },
      });
      ctx.setDraft(null);
    }
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isAngleDraft(prev)) return prev;
      return { ...prev, lastMouse: e.point };
    });
  },

  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op: commits on third click
  },

  onKeyDown(ctx: ToolContext, e: KeyboardEvent) {
    if (e.key === 'Escape') {
      ctx.setDraft(null);
    }
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isAngleDraft(draft) || draft.clicks.length < 1) return;

    const color = draft.color || '#111827';
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);

    const vertex = draft.clicks[0];
    const vx = vertex.x * w, vy = vertex.y * h;

    if (draft.clicks.length === 1) {
      // Draw line from vertex to cursor
      ctx2d.beginPath();
      ctx2d.moveTo(vx, vy);
      ctx2d.lineTo(draft.lastMouse.x * w, draft.lastMouse.y * h);
      ctx2d.stroke();
    } else if (draft.clicks.length === 2) {
      const ray1 = draft.clicks[1];
      // Draw ray1
      ctx2d.beginPath();
      ctx2d.moveTo(vx, vy);
      ctx2d.lineTo(ray1.x * w, ray1.y * h);
      ctx2d.stroke();

      // Draw ray2 (to cursor)
      ctx2d.beginPath();
      ctx2d.setLineDash([4, 4]);
      ctx2d.moveTo(vx, vy);
      ctx2d.lineTo(draft.lastMouse.x * w, draft.lastMouse.y * h);
      ctx2d.stroke();
      ctx2d.setLineDash([]);

      // Draw arc
      const a1 = Math.atan2(ray1.y - vertex.y, ray1.x - vertex.x);
      const a2 = Math.atan2(draft.lastMouse.y - vertex.y, draft.lastMouse.x - vertex.x);
      const arcRadius = 20;
      ctx2d.beginPath();
      ctx2d.arc(vx, vy, arcRadius, a1, a2, false);
      ctx2d.stroke();

      // Draw angle label
      const deg = computeAngleDeg(vertex, ray1, draft.lastMouse);
      const midAngle = (a1 + a2) / 2;
      const lx = vx + (arcRadius + 12) * Math.cos(midAngle);
      const ly = vy + (arcRadius + 12) * Math.sin(midAngle);
      ctx2d.font = '12px sans-serif';
      ctx2d.fillStyle = color;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(`${deg.toFixed(1)}°`, lx, ly);
      ctx2d.textAlign = 'start';
      ctx2d.textBaseline = 'alphabetic';
    }
  },
};

registerTool(angleTool);
export default angleTool;
