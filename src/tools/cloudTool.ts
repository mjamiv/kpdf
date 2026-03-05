import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { normalizeRect, drawCloudShape } from '../engine/utils';

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
    drawCloudShape(ctx2d, x, y, rw, rh);
  },
};

registerTool(cloudTool);
export default cloudTool;
