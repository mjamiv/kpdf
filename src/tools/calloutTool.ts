import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import { normalizeRect } from '../engine/utils';
import { computeBoxEdgeAnchor } from '../engine/calloutGeometry';

/**
 * Callout draft tracks the 3-phase creation flow:
 *   phase 1 — placing the anchor dot (leaderTarget)
 *   phase 2 — placing the knee (elbow bend)
 *   phase 3 — dragging out the text box
 */
type CalloutDraft = {
  toolType: 'callout';
  phase: 1 | 2 | 3;
  anchor: Point;
  knee: Point | null;
  boxStart: Point | null;
  boxEnd: Point | null;
  /** Live cursor position for preview lines */
  cursor: Point;
};

export function isCalloutDraft(draft: unknown): draft is CalloutDraft {
  return draft !== null && typeof draft === 'object' && (draft as CalloutDraft).toolType === 'callout';
}

const ANCHOR_RADIUS_PX = 5;
const MIN_BOX_SIZE = 0.001;
const DEFAULT_BOX_W = 0.12;
const DEFAULT_BOX_H = 0.04;

const calloutTool: ToolBehavior = {
  name: 'callout',
  label: 'Callout',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const draft = ctx.draft;

    if (!isCalloutDraft(draft)) {
      // Phase 1: place anchor
      ctx.setDraft({
        toolType: 'callout',
        phase: 1,
        anchor: e.point,
        knee: null,
        boxStart: null,
        boxEnd: null,
        cursor: e.point,
      } as CalloutDraft);
      return;
    }

    if (draft.phase === 1) {
      // Phase 2: place knee
      ctx.setDraft({ ...draft, phase: 2, knee: e.point, cursor: e.point });
      return;
    }

    if (draft.phase === 2) {
      // Phase 3: start dragging text box
      ctx.setDraft({ ...draft, phase: 3, boxStart: e.point, boxEnd: e.point, cursor: e.point });
      return;
    }
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isCalloutDraft(prev)) return prev;

      if (prev.phase === 3 && prev.boxStart) {
        return { ...prev, boxEnd: e.point, cursor: e.point };
      }
      return { ...prev, cursor: e.point };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isCalloutDraft(draft)) { ctx.setDraft(null); return; }

    // Only finalize on phase 3 (box drag complete)
    if (draft.phase !== 3 || !draft.boxStart || !draft.boxEnd || !draft.knee) return;

    let box = normalizeRect(draft.boxStart, draft.boxEnd);

    // If the user just clicked (no drag), create a default-sized box
    if (box.width < MIN_BOX_SIZE && box.height < MIN_BOX_SIZE) {
      box = { x: draft.boxStart.x, y: draft.boxStart.y, width: DEFAULT_BOX_W, height: DEFAULT_BOX_H };
    }

    const text = globalThis.prompt('Enter callout text:');
    if (!text) { ctx.setDraft(null); return; }

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
        leaderTarget: draft.anchor,
        knee: draft.knee,
        text,
        fontSize: 0.012,
      },
    });
    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isCalloutDraft(draft)) return;

    const ax = draft.anchor.x * w;
    const ay = draft.anchor.y * h;
    const cx = draft.cursor.x * w;
    const cy = draft.cursor.y * h;

    // Always draw anchor dot
    ctx2d.fillStyle = '#111827';
    ctx2d.beginPath();
    ctx2d.arc(ax, ay, ANCHOR_RADIUS_PX, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.strokeStyle = '#111827';
    ctx2d.lineWidth = 1.5;
    ctx2d.setLineDash([]);

    if (draft.phase === 1) {
      // Preview: line from anchor to cursor
      ctx2d.beginPath();
      ctx2d.setLineDash([4, 4]);
      ctx2d.moveTo(ax, ay);
      ctx2d.lineTo(cx, cy);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
      return;
    }

    const kx = draft.knee!.x * w;
    const ky = draft.knee!.y * h;

    // Draw anchor → knee
    ctx2d.beginPath();
    ctx2d.moveTo(ax, ay);
    ctx2d.lineTo(kx, ky);
    ctx2d.stroke();

    if (draft.phase === 2) {
      // Preview: dashed line from knee to cursor
      ctx2d.beginPath();
      ctx2d.setLineDash([4, 4]);
      ctx2d.moveTo(kx, ky);
      ctx2d.lineTo(cx, cy);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
      return;
    }

    // Phase 3: draw box + knee → box edge
    if (draft.boxStart && draft.boxEnd) {
      const box = normalizeRect(draft.boxStart, draft.boxEnd);
      const bx = box.x * w;
      const by = box.y * h;
      const bw = box.width * w;
      const bh = box.height * h;

      // Box
      ctx2d.strokeRect(bx, by, bw, bh);

      // Knee → box edge
      const edge = computeBoxEdgeAnchor(draft.knee!, box);
      ctx2d.beginPath();
      ctx2d.moveTo(kx, ky);
      ctx2d.lineTo(edge.x * w, edge.y * h);
      ctx2d.stroke();
    }
  },
};

registerTool(calloutTool);
export default calloutTool;
