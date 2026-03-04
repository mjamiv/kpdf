import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import { registerTool } from './registry';

const stampTool: ToolBehavior = {
  name: 'stamp',
  label: 'Stamp',
  cursor: 'copy',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
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
        type: 'stamp',
        x: e.point.x - 0.04,
        y: e.point.y - 0.02,
        width: 0.08,
        height: 0.04,
        stampId: 'approved',
        label: 'APPROVED',
      },
    });
  },

  onPointerMove(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op
  },

  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op
  },
};

registerTool(stampTool);
export default stampTool;
