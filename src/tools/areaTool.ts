import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type AreaDraft = {
  toolType: 'area';
  points: Point[];
  lastMouse: Point;
  color: string;
};

export function isAreaDraft(draft: unknown): draft is AreaDraft {
  return draft !== null && typeof draft === 'object' && (draft as AreaDraft).toolType === 'area';
}

const THICKNESS = 0.0025;
const CLOSE_THRESHOLD = 0.015;

export function shoelaceArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function centroid(points: Point[]): Point {
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / points.length, y: cy / points.length };
}

const areaTool: ToolBehavior = {
  name: 'area',
  label: 'Area',
  cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23357a45' stroke-width='1.5'%3E%3Cline x1='12' y1='2' x2='12' y2='22'/%3E%3Cline x1='2' y1='12' x2='22' y2='12'/%3E%3Cline x1='12' y1='6' x2='14' y2='6'/%3E%3Cline x1='12' y1='10' x2='13' y2='10'/%3E%3Cline x1='12' y1='14' x2='13' y2='14'/%3E%3Cline x1='12' y1='18' x2='14' y2='18'/%3E%3C/svg%3E") 12 12, crosshair`,

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;

    if (!isAreaDraft(draft)) {
      ctx.setDraft({ toolType: 'area', points: [e.point], lastMouse: e.point, color: ctx.color } as AreaDraft);
      return;
    }

    // Check if closing
    const first = draft.points[0];
    const dx = e.point.x - first.x;
    const dy = e.point.y - first.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CLOSE_THRESHOLD && draft.points.length >= 3) {
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
          type: 'area',
          points: draft.points,
          thickness: THICKNESS,
          scale: ctx.pageScale ? ctx.pageScale.realDistance / ctx.pageScale.pixelDistance : 1,
          unit: ctx.pageScale ? ctx.pageScale.unit : 'sq px',
        },
      });
      ctx.setDraft(null);
      return;
    }

    ctx.setDraft({ ...draft, points: [...draft.points, e.point] });
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isAreaDraft(prev)) return prev;
      return { ...prev, lastMouse: e.point };
    });
  },

  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op: area commits on close
  },

  onKeyDown(ctx: ToolContext, e: KeyboardEvent) {
    if (e.key === 'Escape') {
      ctx.setDraft(null);
    }
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isAreaDraft(draft) || draft.points.length < 1) return;

    const color = draft.color || '#111827';
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);
    ctx2d.lineJoin = 'round';

    // Draw polygon edges
    ctx2d.beginPath();
    ctx2d.moveTo(draft.points[0].x * w, draft.points[0].y * h);
    for (let i = 1; i < draft.points.length; i++) {
      ctx2d.lineTo(draft.points[i].x * w, draft.points[i].y * h);
    }
    ctx2d.stroke();

    // Dashed line from last point to cursor
    const last = draft.points[draft.points.length - 1];
    ctx2d.beginPath();
    ctx2d.setLineDash([4, 4]);
    ctx2d.moveTo(last.x * w, last.y * h);
    ctx2d.lineTo(draft.lastMouse.x * w, draft.lastMouse.y * h);
    ctx2d.stroke();

    // Dashed line from cursor back to first point
    ctx2d.moveTo(draft.lastMouse.x * w, draft.lastMouse.y * h);
    ctx2d.lineTo(draft.points[0].x * w, draft.points[0].y * h);
    ctx2d.stroke();
    ctx2d.setLineDash([]);

    // Show area at centroid if 3+ points
    if (draft.points.length >= 3) {
      const area = shoelaceArea(draft.points);
      const c = centroid(draft.points);
      ctx2d.font = '12px sans-serif';
      ctx2d.fillStyle = color;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(`${area.toFixed(4)} sq px`, c.x * w, c.y * h);
      ctx2d.textAlign = 'start';
      ctx2d.textBaseline = 'alphabetic';
    }
  },
};

registerTool(areaTool);
export default areaTool;
