import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { hitTestAnnotations, boundingBox } from '../engine/hitTest';
import { selectAnnotation, toggleAnnotation, deselectAll, selectMultiple } from '../engine/selection';

export type SelectDraft = {
  toolType: 'select';
  dragOrigin: Point;
  lastPoint: Point;
  isDragging: boolean;
  totalDx: number;
  totalDy: number;
};

export type MarqueeDraft = {
  toolType: 'marquee';
  origin: Point;
  current: Point;
};

export function isSelectDraft(draft: unknown): draft is SelectDraft {
  return draft !== null && typeof draft === 'object' && (draft as SelectDraft).toolType === 'select';
}

export function isMarqueeDraft(draft: unknown): draft is MarqueeDraft {
  return draft !== null && typeof draft === 'object' && (draft as MarqueeDraft).toolType === 'marquee';
}

export let currentHoveredId: string | null = null;

function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const selectTool: ToolBehavior = {
  name: 'select',
  label: 'Select',
  cursor: 'default',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const hit = hitTestAnnotations(e.point, ctx.annotations);

    if (hit) {
      if (hit.locked) return;

      if (e.shiftKey) {
        ctx.setSelection(toggleAnnotation(ctx.selection, hit.id, ctx.annotations));
      } else if (!ctx.selection.ids.has(hit.id)) {
        ctx.setSelection(selectAnnotation(ctx.selection, hit.id, ctx.annotations));
      }

      ctx.setDraft({ toolType: 'select', dragOrigin: e.point, lastPoint: e.point, isDragging: false, totalDx: 0, totalDy: 0 } as SelectDraft);
    } else {
      if (!e.shiftKey) {
        ctx.setSelection(deselectAll());
      }
      ctx.setDraft({ toolType: 'marquee', origin: e.point, current: e.point } as MarqueeDraft);
    }
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;

    if (isMarqueeDraft(draft)) {
      ctx.setDraft({ ...draft, current: e.point });
      return;
    }

    if (isSelectDraft(draft)) {
      if (ctx.selection.ids.size === 0) return;

      const dx = e.point.x - draft.lastPoint.x;
      const dy = e.point.y - draft.lastPoint.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        ctx.setDraft({
          ...draft,
          lastPoint: e.point,
          isDragging: true,
          totalDx: draft.totalDx + dx,
          totalDy: draft.totalDy + dy,
        });
      }
      return;
    }

    const hit = hitTestAnnotations(e.point, ctx.annotations);
    currentHoveredId = hit ? hit.id : null;
  },

  onPointerUp(ctx: ToolContext) {
    const draft = ctx.draft;

    if (isMarqueeDraft(draft)) {
      const x1 = Math.min(draft.origin.x, draft.current.x);
      const y1 = Math.min(draft.origin.y, draft.current.y);
      const mw = Math.abs(draft.current.x - draft.origin.x);
      const mh = Math.abs(draft.current.y - draft.origin.y);

      if (mw > 0.001 || mh > 0.001) {
        const hitIds: string[] = [];
        for (const ann of ctx.annotations) {
          if (ann.locked) continue;
          const bb = boundingBox(ann);
          if (rectsIntersect(x1, y1, mw, mh, bb.x, bb.y, bb.width, bb.height)) {
            hitIds.push(ann.id);
          }
        }
        if (hitIds.length > 0) {
          ctx.setSelection(selectMultiple(ctx.selection, hitIds, ctx.annotations));
        }
      }
      ctx.setDraft(null);
      return;
    }

    if (isSelectDraft(draft) && draft.isDragging && ctx.selection.ids.size > 0) {
      for (const id of ctx.selection.ids) {
        ctx.dispatch({
          type: 'MOVE_ANNOTATION',
          page: ctx.page,
          id,
          dx: draft.totalDx,
          dy: draft.totalDy,
        });
      }
    }
    ctx.setDraft(null);
  },

  renderDraft(ctx: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isMarqueeDraft(draft)) return;

    const x = Math.min(draft.origin.x, draft.current.x) * w;
    const y = Math.min(draft.origin.y, draft.current.y) * h;
    const rw = Math.abs(draft.current.x - draft.origin.x) * w;
    const rh = Math.abs(draft.current.y - draft.origin.y) * h;

    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.fillRect(x, y, rw, rh);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, rw, rh);
    ctx.restore();
  },
};

registerTool(selectTool);
export default selectTool;
