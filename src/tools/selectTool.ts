import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { hitTestAnnotations } from '../engine/hitTest';
import { selectAnnotation, toggleAnnotation, deselectAll } from '../engine/selection';

type SelectDraft = {
  toolType: 'select';
  dragOrigin: Point;
  lastPoint: Point;
  isDragging: boolean;
};

function isSelectDraft(draft: unknown): draft is SelectDraft {
  return draft !== null && typeof draft === 'object' && (draft as SelectDraft).toolType === 'select';
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

      ctx.setDraft({ toolType: 'select', dragOrigin: e.point, lastPoint: e.point, isDragging: false } as SelectDraft);
    } else {
      ctx.setSelection(deselectAll());
      ctx.setDraft(null);
    }
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isSelectDraft(draft)) return;
    if (ctx.selection.ids.size === 0) return;

    const dx = e.point.x - draft.lastPoint.x;
    const dy = e.point.y - draft.lastPoint.y;

    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      for (const id of ctx.selection.ids) {
        ctx.dispatch({
          type: 'MOVE_ANNOTATION',
          page: ctx.page,
          id,
          dx,
          dy,
        });
      }
      ctx.setDraft({ ...draft, lastPoint: e.point, isDragging: true });
    }
  },

  onPointerUp(ctx: ToolContext) {
    ctx.setDraft(null);
  },
};

registerTool(selectTool);
export default selectTool;
