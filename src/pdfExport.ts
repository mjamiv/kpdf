import { PDFDocument, rgb } from 'pdf-lib';
import type { Annotation, Point } from './types';

const EPSILON = 1e-6;

export function toPdfPoint(point: Point, pageWidth: number, pageHeight: number): Point {
  return {
    x: point.x * pageWidth,
    y: pageHeight - point.y * pageHeight,
  };
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
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

function drawAnnotations(
  page: ReturnType<PDFDocument['getPages']>[number],
  annotations: Annotation[],
): void {
  const { width, height } = page.getSize();

  annotations.forEach((annotation) => {
    const parsed = parseHex(annotation.color);
    const color = rgb(parsed.r, parsed.g, parsed.b);

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

      default:
        break;
    }
  });
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
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();

  if (options.flatten) {
    pages.forEach((page, pageIndex) => {
      const annotations = annotationsByPage[pageIndex + 1] ?? [];
      if (annotations.length === 0) return;
      drawAnnotations(page, annotations);
    });
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
