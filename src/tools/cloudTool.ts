import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { normalizeRect } from '../engine/utils';

type CloudDraft = {
  toolType: 'cloud';
  start: Point;
  end: Point;
};

export function isCloudDraft(draft: unknown): draft is CloudDraft {
  return draft !== null && typeof draft === 'object' && (draft as CloudDraft).toolType === 'cloud';
}

const cloudTool: ToolBehavior = {
  name: 'cloud',
  label: 'Cloud',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'cloud', start: e.point, end: e.point } as CloudDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isCloudDraft(prev)) return prev;
      return { ...prev, end: e.point };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isCloudDraft(draft)) { ctx.setDraft(null); return; }

    const rect = normalizeRect(draft.start, draft.end);
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
        type: 'cloud',
        ...rect,
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isCloudDraft(draft)) return;

    const rect = normalizeRect(draft.start, draft.end);
    const x = rect.x * w;
    const y = rect.y * h;
    const rw = rect.width * w;
    const rh = rect.height * h;

    ctx2d.strokeStyle = '#111827';
    ctx2d.lineWidth = 1.5;

    // Draw scalloped border using arcs along each edge
    const arcRadius = 8;
    ctx2d.beginPath();

    // Top edge
    const topArcs = Math.max(Math.round(rw / (arcRadius * 2)), 1);
    const topStep = rw / topArcs;
    for (let i = 0; i < topArcs; i++) {
      const cx = x + topStep * i + topStep / 2;
      ctx2d.arc(cx, y, topStep / 2, Math.PI, 0, false);
    }

    // Right edge
    const rightArcs = Math.max(Math.round(rh / (arcRadius * 2)), 1);
    const rightStep = rh / rightArcs;
    for (let i = 0; i < rightArcs; i++) {
      const cy = y + rightStep * i + rightStep / 2;
      ctx2d.arc(x + rw, cy, rightStep / 2, -Math.PI / 2, Math.PI / 2, false);
    }

    // Bottom edge
    for (let i = topArcs - 1; i >= 0; i--) {
      const cx = x + topStep * i + topStep / 2;
      ctx2d.arc(cx, y + rh, topStep / 2, 0, Math.PI, false);
    }

    // Left edge
    for (let i = rightArcs - 1; i >= 0; i--) {
      const cy = y + rightStep * i + rightStep / 2;
      ctx2d.arc(x, cy, rightStep / 2, Math.PI / 2, -Math.PI / 2, false);
    }

    ctx2d.closePath();
    ctx2d.stroke();
  },
};

registerTool(cloudTool);
export default cloudTool;
