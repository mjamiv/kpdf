import type { PDFDocument as PDFDocumentType, PDFPage } from 'pdf-lib';
import type { Annotation, Point } from './types';
import { clamp01 } from './engine/utils';

const EPSILON = 1e-6;

export function toPdfPoint(point: Point, pageWidth: number, pageHeight: number): Point {
  return {
    x: point.x * pageWidth,
    y: pageHeight - point.y * pageHeight,
  };
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3
    ? clean.split('').map((ch) => ch + ch).join('')
    : clean;

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}

export function toLineSegments(points: Point[]): Array<{ start: Point; end: Point }> {
  if (points.length < 2) return [];

  const segments: Array<{ start: Point; end: Point }> = [];
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    if (Math.abs(start.x - end.x) < EPSILON && Math.abs(start.y - end.y) < EPSILON) {
      continue;
    }
    segments.push({ start, end });
  }
  return segments;
}

async function drawAnnotations(
  page: PDFPage,
  annotations: Annotation[],
  rgbFn: typeof import('pdf-lib').rgb,
  pdfDoc?: PDFDocumentType,
): Promise<void> {
  const { width, height } = page.getSize();

  for (const annotation of annotations) {
    const parsed = parseHex(annotation.color);
    const color = rgbFn(parsed.r, parsed.g, parsed.b);

    switch (annotation.type) {
      case 'pen': {
        const segments = toLineSegments(annotation.points);
        const thickness = Math.max(annotation.thickness * width, 0.5);

        segments.forEach((segment) => {
          const start = toPdfPoint(segment.start, width, height);
          const end = toPdfPoint(segment.end, width, height);

          page.drawLine({
            start,
            end,
            thickness,
            color,
          });
        });
        break;
      }

      case 'rectangle':
      case 'highlight': {
        const x = clamp01(annotation.x) * width;
        const rectWidth = clamp01(annotation.width) * width;
        const rectHeight = clamp01(annotation.height) * height;
        const yTop = clamp01(annotation.y) * height;
        const y = height - yTop - rectHeight;

        if (annotation.type === 'highlight') {
          page.drawRectangle({
            x,
            y,
            width: rectWidth,
            height: rectHeight,
            color,
            opacity: 0.2,
            borderColor: color,
            borderWidth: 0,
          });
          break;
        }

        page.drawRectangle({
          x,
          y,
          width: rectWidth,
          height: rectHeight,
          borderColor: color,
          borderWidth: Math.max(annotation.thickness * width, 0.5),
          opacity: 0,
        });
        break;
      }

      case 'text': {
        const textPoint = toPdfPoint({ x: annotation.x, y: annotation.y }, width, height);
        page.drawText(annotation.text, {
          x: textPoint.x,
          y: textPoint.y,
          color,
          size: Math.max(annotation.fontSize * width, 8),
        });
        break;
      }

      case 'arrow': {
        const aStart = toPdfPoint(annotation.start, width, height);
        const aEnd = toPdfPoint(annotation.end, width, height);
        const aThickness = Math.max(annotation.thickness * width, 0.5);

        page.drawLine({ start: aStart, end: aEnd, thickness: aThickness, color });

        // Draw arrowhead
        const dx = aEnd.x - aStart.x;
        const dy = aEnd.y - aStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const headLen = annotation.headSize * width;
          const ux = dx / len;
          const uy = dy / len;
          const headAngle = Math.PI / 6;
          const cos = Math.cos(headAngle);
          const sin = Math.sin(headAngle);

          page.drawLine({
            start: aEnd,
            end: { x: aEnd.x - headLen * (ux * cos + uy * sin), y: aEnd.y - headLen * (-ux * sin + uy * cos) },
            thickness: aThickness,
            color,
          });
          page.drawLine({
            start: aEnd,
            end: { x: aEnd.x - headLen * (ux * cos - uy * sin), y: aEnd.y - headLen * (ux * sin + uy * cos) },
            thickness: aThickness,
            color,
          });
        }
        break;
      }

      case 'callout': {
        const box = annotation.box;
        const cX = clamp01(box.x) * width;
        const cW = clamp01(box.width) * width;
        const cH = clamp01(box.height) * height;
        const cYTop = clamp01(box.y) * height;
        const cY = height - cYTop - cH;

        page.drawRectangle({
          x: cX,
          y: cY,
          width: cW,
          height: cH,
          borderColor: color,
          borderWidth: 1,
          opacity: 0,
        });

        const boxCenter = toPdfPoint(
          { x: box.x + box.width / 2, y: box.y + box.height / 2 },
          width,
          height,
        );
        const leader = toPdfPoint(annotation.leaderTarget, width, height);
        page.drawLine({ start: boxCenter, end: leader, thickness: 1, color });

        const textSize = Math.max(annotation.fontSize * width, 8);
        page.drawText(annotation.text, {
          x: cX + 2,
          y: cY + cH / 2 - textSize / 2,
          color,
          size: textSize,
        });
        break;
      }

      case 'cloud': {
        const clX = clamp01(annotation.x) * width;
        const clW = clamp01(annotation.width) * width;
        const clH = clamp01(annotation.height) * height;
        const clYTop = clamp01(annotation.y) * height;
        const clY = height - clYTop - clH;

        page.drawRectangle({
          x: clX,
          y: clY,
          width: clW,
          height: clH,
          borderColor: color,
          borderWidth: 1,
          opacity: 0,
        });
        break;
      }

      case 'measurement': {
        const mStart = toPdfPoint(annotation.start, width, height);
        const mEnd = toPdfPoint(annotation.end, width, height);
        const mThickness = Math.max(annotation.thickness * width, 0.5);

        page.drawLine({ start: mStart, end: mEnd, thickness: mThickness, color });

        const mdx = annotation.end.x - annotation.start.x;
        const mdy = annotation.end.y - annotation.start.y;
        const dist = Math.sqrt(mdx * mdx + mdy * mdy) * annotation.scale;
        const label = `${dist.toFixed(2)} ${annotation.unit}`;
        const mid = toPdfPoint(
          { x: (annotation.start.x + annotation.end.x) / 2, y: (annotation.start.y + annotation.end.y) / 2 },
          width,
          height,
        );
        page.drawText(label, { x: mid.x, y: mid.y + 4, color, size: 10 });
        break;
      }

      case 'polygon': {
        const pSegments = toLineSegments(annotation.points);
        const pThickness = Math.max(annotation.thickness * width, 0.5);

        pSegments.forEach((seg) => {
          const pStart = toPdfPoint(seg.start, width, height);
          const pEnd = toPdfPoint(seg.end, width, height);
          page.drawLine({ start: pStart, end: pEnd, thickness: pThickness, color });
        });

        if (annotation.closed && annotation.points.length >= 3) {
          const first = toPdfPoint(annotation.points[0], width, height);
          const last = toPdfPoint(annotation.points[annotation.points.length - 1], width, height);
          page.drawLine({ start: last, end: first, thickness: pThickness, color });
        }
        break;
      }

      case 'stamp': {
        const sX = clamp01(annotation.x) * width;
        const sW = clamp01(annotation.width) * width;
        const sH = clamp01(annotation.height) * height;
        const sYTop = clamp01(annotation.y) * height;
        const sY = height - sYTop - sH;

        // Try to embed image if present
        let imageEmbedded = false;
        if (annotation.imageUrl && pdfDoc) {
          try {
            const dataUrl = annotation.imageUrl;
            const base64 = dataUrl.split(',')[1];
            if (base64) {
              const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
              const isPng = dataUrl.includes('image/png') || dataUrl.includes('image/svg');
              const img = isPng
                ? await pdfDoc.embedPng(bytes)
                : await pdfDoc.embedJpg(bytes);
              page.drawImage(img, { x: sX, y: sY, width: sW, height: sH });
              imageEmbedded = true;
            }
          } catch {
            // Fall back to text rendering
          }
        }

        if (!imageEmbedded) {
          page.drawRectangle({
            x: sX,
            y: sY,
            width: sW,
            height: sH,
            borderColor: color,
            borderWidth: 1,
            opacity: 0,
          });

          const sTextSize = Math.max(Math.min(sW / Math.max(annotation.label.length, 1) * 1.5, sH * 0.6), 8);
          page.drawText(annotation.label, {
            x: sX + sW / 2 - (annotation.label.length * sTextSize * 0.3),
            y: sY + sH / 2 - sTextSize / 2,
            color,
            size: sTextSize,
          });
        }
        break;
      }

      case 'area': {
        const aSegments = toLineSegments(annotation.points);
        const aThickness = Math.max(annotation.thickness * width, 0.5);
        aSegments.forEach((seg) => {
          const aStart = toPdfPoint(seg.start, width, height);
          const aEnd = toPdfPoint(seg.end, width, height);
          page.drawLine({ start: aStart, end: aEnd, thickness: aThickness, color });
        });
        if (annotation.points.length >= 3) {
          const first = toPdfPoint(annotation.points[0], width, height);
          const last = toPdfPoint(annotation.points[annotation.points.length - 1], width, height);
          page.drawLine({ start: last, end: first, thickness: aThickness, color });
          // Area label
          let acx = 0, acy = 0;
          for (const p of annotation.points) { acx += p.x; acy += p.y; }
          acx /= annotation.points.length; acy /= annotation.points.length;
          let areaSum = 0;
          for (let i = 0; i < annotation.points.length; i++) {
            const j = (i + 1) % annotation.points.length;
            areaSum += annotation.points[i].x * annotation.points[j].y - annotation.points[j].x * annotation.points[i].y;
          }
          const areaVal = Math.abs(areaSum) / 2 * annotation.scale;
          const ac = toPdfPoint({ x: acx, y: acy }, width, height);
          page.drawText(`${areaVal.toFixed(2)} ${annotation.unit}`, { x: ac.x, y: ac.y, color, size: 10 });
        }
        break;
      }

      case 'angle': {
        const angThick = Math.max(annotation.thickness * width, 0.5);
        const v = toPdfPoint(annotation.vertex, width, height);
        const r1 = toPdfPoint(annotation.ray1, width, height);
        const r2 = toPdfPoint(annotation.ray2, width, height);
        page.drawLine({ start: v, end: r1, thickness: angThick, color });
        page.drawLine({ start: v, end: r2, thickness: angThick, color });
        const a1 = Math.atan2(annotation.ray1.y - annotation.vertex.y, annotation.ray1.x - annotation.vertex.x);
        const a2 = Math.atan2(annotation.ray2.y - annotation.vertex.y, annotation.ray2.x - annotation.vertex.x);
        let deg = Math.abs(a1 - a2) * (180 / Math.PI);
        if (deg > 180) deg = 360 - deg;
        const midA = (a1 + a2) / 2;
        const lx = annotation.vertex.x + 0.03 * Math.cos(midA);
        const ly = annotation.vertex.y + 0.03 * Math.sin(midA);
        const lp = toPdfPoint({ x: lx, y: ly }, width, height);
        page.drawText(`${deg.toFixed(1)}°`, { x: lp.x, y: lp.y, color, size: 10 });
        break;
      }

      case 'count': {
        const cr = annotation.radius * width;
        const cp = toPdfPoint({ x: annotation.x, y: annotation.y }, width, height);
        page.drawCircle({ x: cp.x, y: cp.y, size: cr, color, opacity: 0.8 });
        page.drawText(`${annotation.number}`, {
          x: cp.x - cr * 0.3,
          y: cp.y - cr * 0.3,
          color: rgbFn(1, 1, 1),
          size: Math.max(8, cr),
        });
        break;
      }

      case 'dimension': {
        const ddx = annotation.end.x - annotation.start.x;
        const ddy = annotation.end.y - annotation.start.y;
        const dLen = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dLen > 0) {
          const nx = -ddy / dLen, ny = ddx / dLen;
          const os = annotation.offset;
          const ds = toPdfPoint({ x: annotation.start.x + nx * os, y: annotation.start.y + ny * os }, width, height);
          const de = toPdfPoint({ x: annotation.end.x + nx * os, y: annotation.end.y + ny * os }, width, height);
          const dThick = Math.max(annotation.thickness * width, 0.5);
          page.drawLine({ start: ds, end: de, thickness: dThick, color });
          // Tick marks
          const ts = 0.008 * width;
          page.drawLine({ start: { x: ds.x - nx * ts, y: ds.y + ny * ts }, end: { x: ds.x + nx * ts, y: ds.y - ny * ts }, thickness: dThick, color });
          page.drawLine({ start: { x: de.x - nx * ts, y: de.y + ny * ts }, end: { x: de.x + nx * ts, y: de.y - ny * ts }, thickness: dThick, color });
          // Label
          const dist = dLen * annotation.scale;
          const dm = { x: (ds.x + de.x) / 2, y: (ds.y + de.y) / 2 + 4 };
          page.drawText(`${dist.toFixed(1)} ${annotation.unit}`, { x: dm.x, y: dm.y, color, size: 10 });
        }
        break;
      }

      case 'ellipse': {
        const eX = clamp01(annotation.x) * width;
        const eW = clamp01(annotation.width) * width;
        const eH = clamp01(annotation.height) * height;
        const eYTop = clamp01(annotation.y) * height;
        const eY = height - eYTop - eH;
        page.drawEllipse({
          x: eX + eW / 2,
          y: eY + eH / 2,
          xScale: eW / 2,
          yScale: eH / 2,
          borderColor: color,
          borderWidth: Math.max(annotation.thickness * width, 0.5),
          opacity: 0,
        });
        break;
      }

      case 'polyline': {
        const plSegments = toLineSegments(annotation.points);
        const plThickness = Math.max(annotation.thickness * width, 0.5);
        plSegments.forEach((seg) => {
          const plStart = toPdfPoint(seg.start, width, height);
          const plEnd = toPdfPoint(seg.end, width, height);
          page.drawLine({ start: plStart, end: plEnd, thickness: plThickness, color });
        });
        break;
      }

      case 'hyperlink': {
        // Hyperlinks are interactive-only; draw a visible link box when flattening
        const hlX = clamp01(annotation.x) * width;
        const hlW = clamp01(annotation.width) * width;
        const hlH = clamp01(annotation.height) * height;
        const hlYTop = clamp01(annotation.y) * height;
        const hlY = height - hlYTop - hlH;

        page.drawRectangle({
          x: hlX,
          y: hlY,
          width: hlW,
          height: hlH,
          borderColor: color,
          borderWidth: 1,
          opacity: 0,
        });

        const hlTextSize = Math.max(Math.min(hlW / Math.max(annotation.label.length, 1) * 1.5, hlH * 0.6), 8);
        page.drawText(annotation.label, {
          x: hlX + 2,
          y: hlY + hlH / 2 - hlTextSize / 2,
          color,
          size: hlTextSize,
        });
        break;
      }

      default:
        break;
    }
  }
}

type EmbeddedAttachment = {
  fileName: string;
  mimeType: string;
  description: string;
  content: Uint8Array;
  thresholdBytes: number;
};

type ExportOptions = {
  flatten: boolean;
  embeddedAttachment?: EmbeddedAttachment;
};

export type ExportPersistenceResult = {
  mode: 'attachment' | 'sidecar-only' | 'none';
  payloadBytes: number;
  thresholdBytes: number;
};

export type ExportPdfResult = {
  bytes: Uint8Array;
  persistence: ExportPersistenceResult;
};

export async function exportPdf(
  originalBytes: Uint8Array,
  annotationsByPage: Record<number, Annotation[]>,
  options: ExportOptions,
): Promise<ExportPdfResult> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdfDoc: PDFDocumentType = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();

  if (options.flatten) {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const annotations = annotationsByPage[pageIndex + 1] ?? [];
      if (annotations.length === 0) continue;
      await drawAnnotations(pages[pageIndex], annotations, rgb, pdfDoc);
    }
  }

  let persistence: ExportPersistenceResult = {
    mode: 'none',
    payloadBytes: 0,
    thresholdBytes: 0,
  };

  if (options.embeddedAttachment) {
    const payloadBytes = options.embeddedAttachment.content.byteLength;
    const thresholdBytes = options.embeddedAttachment.thresholdBytes;

    if (payloadBytes <= thresholdBytes) {
      await pdfDoc.attach(options.embeddedAttachment.content, options.embeddedAttachment.fileName, {
        mimeType: options.embeddedAttachment.mimeType,
        description: options.embeddedAttachment.description,
        creationDate: new Date(),
        modificationDate: new Date(),
      });

      persistence = {
        mode: 'attachment',
        payloadBytes,
        thresholdBytes,
      };
    } else {
      persistence = {
        mode: 'sidecar-only',
        payloadBytes,
        thresholdBytes,
      };
    }
  }

  return {
    bytes: await pdfDoc.save(),
    persistence,
  };
}
