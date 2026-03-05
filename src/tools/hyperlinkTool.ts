import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';

type HyperlinkDraft = {
  toolType: 'hyperlink';
  start: Point;
  end: Point;
  targetPage: number;
  label: string;
};

export function isHyperlinkDraft(draft: unknown): draft is HyperlinkDraft {
  return draft !== null && typeof draft === 'object' && (draft as HyperlinkDraft).toolType === 'hyperlink';
}

/** Default target page when creating a hyperlink (user can change via UI). */
const DEFAULT_TARGET_PAGE = 1;
const DEFAULT_LABEL = 'Go to page';

const DEFAULT_WIDTH = 0.08;
const DEFAULT_HEIGHT = 0.03;

const hyperlinkTool: ToolBehavior = {
  name: 'hyperlink',
  label: 'Hyperlink',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({
      toolType: 'hyperlink',
      start: e.point,
      end: { x: e.point.x + DEFAULT_WIDTH, y: e.point.y + DEFAULT_HEIGHT },
      targetPage: DEFAULT_TARGET_PAGE,
      label: DEFAULT_LABEL,
    } as HyperlinkDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isHyperlinkDraft(prev)) return prev;
      return { ...prev, end: e.point };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isHyperlinkDraft(draft)) { ctx.setDraft(null); return; }

    const x = Math.min(draft.start.x, draft.end.x);
    const y = Math.min(draft.start.y, draft.end.y);
    const width = Math.abs(draft.end.x - draft.start.x);
    const height = Math.abs(draft.end.y - draft.start.y);

    // Only create if the area is large enough (not just a click)
    if (width > 0.005 && height > 0.005) {
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
          type: 'hyperlink',
          x,
          y,
          width,
          height,
          targetPage: draft.targetPage,
          label: draft.label,
        },
      });
    }

    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isHyperlinkDraft(draft)) return;

    const x = Math.min(draft.start.x, draft.end.x) * w;
    const y = Math.min(draft.start.y, draft.end.y) * h;
    const dw = Math.abs(draft.end.x - draft.start.x) * w;
    const dh = Math.abs(draft.end.y - draft.start.y) * h;

    ctx2d.save();
    ctx2d.strokeStyle = '#2563eb';
    ctx2d.lineWidth = 2;
    ctx2d.setLineDash([4, 4]);
    ctx2d.strokeRect(x, y, dw, dh);
    ctx2d.fillStyle = 'rgba(37, 99, 235, 0.1)';
    ctx2d.fillRect(x, y, dw, dh);
    ctx2d.restore();
  },
};

/**
 * Compute the normalized rectangle from a hyperlink draft (used in tests).
 */
export function computeHyperlinkRect(start: Point, end: Point): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

registerTool(hyperlinkTool);
export default hyperlinkTool;
