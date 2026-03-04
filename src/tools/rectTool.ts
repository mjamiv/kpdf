import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { normalizeRect } from '../engine/utils';

type RectDraft = {
  toolType: 'rectangle' | 'highlight';
  start: Point;
  end: Point;
};

export function isRectDraft(draft: unknown): draft is RectDraft {
  return draft !== null && typeof draft === 'object' &&
    ((draft as RectDraft).toolType === 'rectangle' || (draft as RectDraft).toolType === 'highlight');
}

const PEN_THICKNESS = 0.0025;

function createRectTool(type: 'rectangle' | 'highlight'): ToolBehavior {
  return {
    name: type,
    label: type === 'rectangle' ? 'Rectangle' : 'Highlight',
    cursor: 'crosshair',

    onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
      ctx.setDraft({ toolType: type, start: e.point, end: e.point } as RectDraft);
    },

    onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
      ctx.setDraft((prev: unknown) => {
        if (!isRectDraft(prev)) return prev;
        return { ...prev, end: e.point };
      });
    },

    onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
      const draft = ctx.draft;
      if (!isRectDraft(draft)) { ctx.setDraft(null); return; }

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
          type: draft.toolType,
          ...rect,
          thickness: PEN_THICKNESS,
        },
      });
      ctx.setDraft(null);
    },

    renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
      if (!isRectDraft(draft)) return;
      const rect = normalizeRect(draft.start, draft.end);
      const x = rect.x * w;
      const y = rect.y * h;
      const width = rect.width * w;
      const height = rect.height * h;

      if (draft.toolType === 'highlight') {
        ctx2d.save();
        ctx2d.fillStyle = '#111827';
        ctx2d.globalAlpha = 0.2;
        ctx2d.fillRect(x, y, width, height);
        ctx2d.restore();
      } else {
        ctx2d.strokeStyle = '#111827';
        ctx2d.lineWidth = Math.max(PEN_THICKNESS * w, 1.5);
        ctx2d.strokeRect(x, y, width, height);
      }
    },
  };
}

const rectangleTool = createRectTool('rectangle');
const highlightTool = createRectTool('highlight');

registerTool(rectangleTool);
registerTool(highlightTool);

export { rectangleTool, highlightTool };
