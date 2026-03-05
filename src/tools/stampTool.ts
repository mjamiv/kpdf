import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import { registerTool } from './registry';
import { STAMP_LIBRARY, type StampDef } from '../workflow/stamps';

let activeStamp: StampDef = STAMP_LIBRARY[0];

export function getActiveStamp(): StampDef { return activeStamp; }
export function setActiveStamp(stamp: StampDef) { activeStamp = stamp; }

const stampTool: ToolBehavior = {
  name: 'stamp',
  label: 'Stamp',
  cursor: 'copy',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const stamp = activeStamp;
    const timestamp = new Date().toISOString();
    ctx.dispatch({
      type: 'ADD_ANNOTATION',
      page: ctx.page,
      annotation: {
        id: ctx.randomId(),
        zIndex: ctx.nextZIndex(),
        color: stamp.color,
        author: ctx.author,
        createdAt: timestamp,
        updatedAt: timestamp,
        locked: false,
        type: 'stamp',
        x: e.point.x - stamp.defaultWidth / 2,
        y: e.point.y - stamp.defaultHeight / 2,
        width: stamp.defaultWidth,
        height: stamp.defaultHeight,
        stampId: stamp.id,
        label: stamp.label,
      },
    });
  },

  onPointerMove(_ctx: ToolContext, _e: NormalizedPointerEvent) {},
  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {},
};

registerTool(stampTool);
export default stampTool;
