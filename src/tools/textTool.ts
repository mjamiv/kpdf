import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import { registerTool } from './registry';

export const FONT_SIZE = 0.018;

export type TextDraft = {
  toolType: 'text';
  x: number;
  y: number;
  color: string;
  author: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  fontSize?: number;
};

export function isTextDraft(d: unknown): d is TextDraft {
  return d !== null && typeof d === 'object' && (d as TextDraft).toolType === 'text';
}

const textTool: ToolBehavior = {
  name: 'text',
  label: 'Text',
  cursor: 'text',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    // Set draft to show inline input at click position
    ctx.setDraft({
      toolType: 'text',
      x: e.point.x,
      y: e.point.y,
      color: ctx.color,
      author: ctx.author,
    } as TextDraft);
  },

  onPointerMove() {},
  onPointerUp() {},
};

registerTool(textTool);
export default textTool;
