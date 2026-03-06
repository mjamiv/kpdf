import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import type { Point } from '../types';
import { registerTool } from './registry';
import getStroke from 'perfect-freehand';

type PenDraft = {
  toolType: 'pen';
  points: Point[];
  color: string;
};

export function isPenDraft(draft: unknown): draft is PenDraft {
  return draft !== null && typeof draft === 'object' && (draft as PenDraft).toolType === 'pen';
}

const PEN_THICKNESS = 0.0025;

function getStrokeOptions(canvasWidth: number) {
  return {
    size: PEN_THICKNESS * canvasWidth,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  };
}

function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length < 2) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}

function renderStrokeOutline(
  ctx2d: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  w: number,
  h: number,
) {
  const inputPoints = points.map((p) => [p.x * w, p.y * h]);
  const outline = getStroke(inputPoints, getStrokeOptions(w));
  if (outline.length < 2) return;
  ctx2d.fillStyle = color;
  ctx2d.fill(outlineToPath(outline));
}

const penTool: ToolBehavior = {
  name: 'pen',
  label: 'Pen',
  cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23366096' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/%3E%3C/svg%3E") 2 22, crosshair`,

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft({ toolType: 'pen', points: [e.point], color: ctx.color } as PenDraft);
  },

  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent) {
    ctx.setDraft((prev: unknown) => {
      if (!isPenDraft(prev)) return prev;
      // Mutate points array for O(1) append during drawing (draft is transient)
      prev.points.push(e.point);
      return { ...prev };
    });
  },

  onPointerUp(ctx: ToolContext, _e: NormalizedPointerEvent) {
    const draft = ctx.draft;
    if (!isPenDraft(draft)) { ctx.setDraft(null); return; }

    if (draft.points.length > 1) {
      // Compute stroke widths from perfect-freehand
      const inputPoints = draft.points.map((p) => [p.x, p.y]);
      const outline = getStroke(inputPoints, {
        size: PEN_THICKNESS,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });
      // Sample stroke widths: for each original point, estimate width from outline
      const strokeWidths = draft.points.map(() => PEN_THICKNESS);
      if (outline.length > 0) {
        const step = Math.max(1, Math.floor(outline.length / draft.points.length));
        for (let i = 0; i < draft.points.length && i * step < outline.length; i++) {
          // Use the outline to estimate local width (distance between opposing outline points)
          const idx = i * step;
          const oppositeIdx = outline.length - 1 - idx;
          if (oppositeIdx >= 0 && oppositeIdx < outline.length) {
            const dx = outline[idx][0] - outline[oppositeIdx][0];
            const dy = outline[idx][1] - outline[oppositeIdx][1];
            strokeWidths[i] = Math.sqrt(dx * dx + dy * dy);
          }
        }
      }

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
          type: 'pen',
          points: draft.points,
          thickness: PEN_THICKNESS,
          strokeWidths,
        },
      });
    }

    ctx.setDraft(null);
  },

  renderDraft(ctx2d: CanvasRenderingContext2D, draft: unknown, w: number, h: number) {
    if (!isPenDraft(draft) || draft.points.length < 2) return;
    renderStrokeOutline(ctx2d, draft.points, draft.color || '#111827', w, h);
  },
};

registerTool(penTool);
export default penTool;
