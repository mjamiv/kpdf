import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import { registerTool } from './registry';

const FONT_SIZE = 0.018;

const textTool: ToolBehavior = {
  name: 'text',
  label: 'Text',
  cursor: 'text',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const text = window.prompt('Text markup');
    if (!text || !text.trim()) return;

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
        type: 'text',
        text: text.trim(),
        x: e.point.x,
        y: e.point.y,
        fontSize: FONT_SIZE,
      },
    });
  },

  onPointerMove() {},
  onPointerUp() {},
};

registerTool(textTool);
export default textTool;
