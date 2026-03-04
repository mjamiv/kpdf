import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { normalizeRect } from '../engine/utils';

type CalloutDraft = {
  toolType: 'callout';
  start: Point;
  end: Point;
};

export function isCalloutDraft(draft: unknown): draft is CalloutDraft {
  return draft !== null && typeof draft === 'object' && (draft as CalloutDraft).toolType === 'callout';
}

const calloutTool: ToolBehavior = {
  name: 'callout',
  label: 'Callout',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'callout', start: e.point, end: e.point } as CalloutDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isCalloutDraft(prev)) return prev;
      return { ...prev, end: e.point };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isCalloutDraft(draft)) { ctx.setDraft(null); return; }

    const box = normalizeRect(draft.start, draft.end);
    if (box.width < 0.001 || box.height < 0.001) { ctx.setDraft(null); return; }

    const text = window.prompt('Enter callout text:');
    if (!text) { ctx.setDraft(null); return; }

    const leaderTarget: Point = { x: box.x - 0.03, y: box.y - 0.03 };
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
        type: 'callout',
        box,
        leaderTarget,
        text,
        fontSize: 0.012,
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isCalloutDraft(draft)) return;

    const box = normalizeRect(draft.start, draft.end);
    const x = box.x * w;
    const y = box.y * h;
    const bw = box.width * w;
    const bh = box.height * h;

    // Draw rectangle preview
    ctx2d.strokeStyle = '#111827';
    ctx2d.lineWidth = 1.5;
    ctx2d.strokeRect(x, y, bw, bh);

    // Draw dashed line to leader target
    const lx = (box.x - 0.03) * w;
    const ly = (box.y - 0.03) * h;
    ctx2d.beginPath();
    ctx2d.setLineDash([4, 4]);
    ctx2d.moveTo(x, y);
    ctx2d.lineTo(lx, ly);
    ctx2d.stroke();
    ctx2d.setLineDash([]);
  },
};

registerTool(calloutTool);
export default calloutTool;
