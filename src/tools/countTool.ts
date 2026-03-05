import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type CountDraft = {
  toolType: 'count';
  lastMouse: Point;
  groupId: string;
  nextNumber: number;
  color: string;
};

export function isCountDraft(draft: unknown): draft is CountDraft {
  return draft !== null && typeof draft === 'object' && (draft as CountDraft).toolType === 'count';
}

const RADIUS = 0.012;

const countTool: ToolBehavior = {
  name: 'count',
  label: 'Count',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    let draft = ctx.draft;

    if (!isCountDraft(draft)) {
      // Start new counting session
      draft = {
        toolType: 'count',
        lastMouse: e.point,
        groupId: ctx.randomId(),
        nextNumber: 1,
        color: ctx.color,
      } as CountDraft;
    }

    const d = draft as CountDraft;
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
        type: 'count',
        x: e.point.x,
        y: e.point.y,
        number: d.nextNumber,
        groupId: d.groupId,
        radius: RADIUS,
      },
    });

    ctx.setDraft({ ...d, nextNumber: d.nextNumber + 1, lastMouse: e.point });
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isCountDraft(prev)) return prev;
      return { ...prev, lastMouse: e.point };
    });
  },

  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {
    // no-op
  },

  onKeyDown(ctx: ToolContext, e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      ctx.setDraft(null);
    }
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isCountDraft(draft)) return;

    const color = draft.color || '#111827';
    const cx = draft.lastMouse.x * w;
    const cy = draft.lastMouse.y * h;
    const r = RADIUS * w;

    // Preview circle at cursor
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 1.5;
    ctx2d.setLineDash([3, 3]);
    ctx2d.stroke();
    ctx2d.setLineDash([]);

    // Show next number
    ctx2d.font = `bold ${Math.max(10, r)}px sans-serif`;
    ctx2d.fillStyle = color;
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(`${draft.nextNumber}`, cx, cy);
    ctx2d.textAlign = 'start';
    ctx2d.textBaseline = 'alphabetic';
  },
};

registerTool(countTool);
export default countTool;
