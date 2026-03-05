import type { Annotation, Point, Tool } from '../types';
import { sortedAnnotations, drawCloudShape } from '../engine/utils';
import { getTool } from '../tools';

function drawPen(ctx: CanvasRenderingContext2D, points: Point[], color: string, thickness: number, w: number, h: number) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * w, points[0].y * h);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x * w, points[i].y * h);
  }
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(thickness * w, 1.5);
  ctx.stroke();
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  annotation: { type: string; color: string; x: number; y: number; width: number; height: number; thickness: number },
  w: number, h: number,
) {
  const x = annotation.x * w;
  const y = annotation.y * h;
  const rw = annotation.width * w;
  const rh = annotation.height * h;
  if (annotation.type === 'highlight') {
    ctx.save();
    ctx.fillStyle = annotation.color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x, y, rw, rh);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = Math.max(annotation.thickness * w, 1.5);
  ctx.strokeRect(x, y, rw, rh);
}

function drawArrowShape(ctx: CanvasRenderingContext2D, start: Point, end: Point, color: string, thickness: number, headSize: number, w: number, h: number) {
  const sx = start.x * w, sy = start.y * h;
  const ex = end.x * w, ey = end.y * h;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(thickness * w, 1.5);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  const angle = Math.atan2(ey - sy, ex - sx);
  const hl = headSize * w;
  ctx.beginPath();
  ctx.moveTo(ex - hl * Math.cos(angle - Math.PI / 6), ey - hl * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(ex, ey);
  ctx.lineTo(ex - hl * Math.cos(angle + Math.PI / 6), ey - hl * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawStampShape(ctx: CanvasRenderingContext2D, x: number, y: number, sw: number, sh: number, label: string, color: string, w: number, h: number) {
  const px = x * w, py = y * h, pw = sw * w, ph = sh * h;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.max(12, ph * 0.6)}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, px + pw / 2, py + ph / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

export function drawAnnotations(
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  draft: unknown,
  activeTool: Tool,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  sortedAnnotations(annotations).forEach((ann) => {
    switch (ann.type) {
      case 'pen':
        drawPen(ctx, ann.points, ann.color, ann.thickness, w, h);
        break;
      case 'rectangle':
      case 'highlight':
        drawRect(ctx, ann, w, h);
        break;
      case 'text':
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(ann.fontSize * w, 12)}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillText(ann.text, ann.x * w, ann.y * h);
        break;
      case 'arrow':
        drawArrowShape(ctx, ann.start, ann.end, ann.color, ann.thickness, ann.headSize, w, h);
        break;
      case 'measurement': {
        const sx = ann.start.x * w, sy = ann.start.y * h;
        const ex = ann.end.x * w, ey = ann.end.y * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        const dist = Math.sqrt((ann.end.x - ann.start.x) ** 2 + (ann.end.y - ann.start.y) ** 2) * ann.scale;
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(12, 0.014 * w)}px ui-sans-serif, system-ui`;
        ctx.fillText(`${dist.toFixed(1)} ${ann.unit}`, (sx + ex) / 2 + 4, (sy + ey) / 2 - 4);
        break;
      }
      case 'cloud': {
        const cx = ann.x * w, cy = ann.y * h, cw = ann.width * w, ch = ann.height * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(0.0025 * w, 1.5);
        drawCloudShape(ctx, cx, cy, cw, ch);
        break;
      }
      case 'polygon':
        if (ann.points.length >= 2) {
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h);
          for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h);
          if (ann.closed) ctx.closePath();
          ctx.stroke();
          if (ann.closed) { ctx.save(); ctx.fillStyle = ann.color; ctx.globalAlpha = 0.1; ctx.fill(); ctx.restore(); }
        }
        break;
      case 'stamp':
        drawStampShape(ctx, ann.x, ann.y, ann.width, ann.height, ann.label, ann.color, w, h);
        break;
      case 'callout': {
        const bx = ann.box.x * w, by = ann.box.y * h, bw = ann.box.width * w, bh = ann.box.height * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(0.0025 * w, 1.5);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.beginPath(); ctx.moveTo(bx, by + bh / 2); ctx.lineTo(ann.leaderTarget.x * w, ann.leaderTarget.y * h); ctx.stroke();
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(10, ann.fontSize * w)}px ui-sans-serif, system-ui`;
        ctx.fillText(ann.text, bx + 4, by + bh / 2 + 4, bw - 8);
        break;
      }
    }
  });

  if (draft) {
    const toolBehavior = getTool(activeTool);
    toolBehavior?.renderDraft?.(ctx, draft, w, h);
  }
}
