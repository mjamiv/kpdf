import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type MeasurementDraft = {
  toolType: 'measurement';
  start: Point;
  end: Point;
};

export function isMeasurementDraft(draft: unknown): draft is MeasurementDraft {
  return draft !== null && typeof draft === 'object' && (draft as MeasurementDraft).toolType === 'measurement';
}

const THICKNESS = 0.0025;

const measurementTool: ToolBehavior = {
  name: 'measurement',
  label: 'Measurement',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'measurement', start: e.point, end: e.point } as MeasurementDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isMeasurementDraft(prev)) return prev;
      return { ...prev, end: e.point };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isMeasurementDraft(draft)) { ctx.setDraft(null); return; }

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
        type: 'measurement',
        start: draft.start,
        end: draft.end,
        thickness: THICKNESS,
        scale: 1,
        unit: 'px',
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isMeasurementDraft(draft)) return;

    const sx = draft.start.x * w;
    const sy = draft.start.y * h;
    const ex = draft.end.x * w;
    const ey = draft.end.y * h;

    // Draw line
    ctx2d.beginPath();
    ctx2d.moveTo(sx, sy);
    ctx2d.lineTo(ex, ey);
    ctx2d.strokeStyle = '#111827';
    ctx2d.lineWidth = Math.max(THICKNESS * w, 1.5);
    ctx2d.stroke();

    // Compute distance and draw label at midpoint
    const dx = draft.end.x - draft.start.x;
    const dy = draft.end.y - draft.start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;

    ctx2d.font = '12px sans-serif';
    ctx2d.fillStyle = '#111827';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'bottom';
    ctx2d.fillText(`${dist.toFixed(3)} px`, mx, my - 4);
  },
};

registerTool(measurementTool);
export default measurementTool;
