/**
 * XFDF import/export for KPDF annotations.
 *
 * XFDF (XML Forms Data Format) is defined by ISO 19444-1 and is the standard
 * exchange format for PDF annotations used by Adobe Acrobat, Bluebeam, and others.
 *
 * Coordinate mapping:
 *   KPDF uses normalized [0,1] coordinates.
 *   XFDF uses PDF-space coordinates (origin at bottom-left, in points).
 *   Default page size: 612 x 792 points (US Letter).
 *   The page size is configurable via the `pageWidth` and `pageHeight` parameters.
 *
 * Supported annotation mappings:
 *   KPDF type      -> XFDF element
 *   pen            -> <ink>
 *   rectangle      -> <square>
 *   highlight      -> <highlight>
 *   text           -> <freetext>
 *   arrow          -> <line>
 *   stamp          -> <stamp>
 *   polygon        -> <polygon>
 *   polyline       -> <polyline>   (if it existed; polygon with closed=false)
 *   ellipse        -> <circle>     (if it existed)
 *   callout        -> <freetext> with callout-line
 *   cloud          -> <square> with border-style cloud
 *   measurement    -> <line> with measure dict
 *   hyperlink      -> <link>
 */

import type { Annotation, AnnotationsByPage, Point } from '../types';
import { randomId } from '../engine/utils';

// Default PDF page dimensions in points (US Letter)
const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;

// ── Coordinate conversion ──────────────────────────────────────────────

function toXfdfX(normX: number, pageWidth: number): number {
  return normX * pageWidth;
}

function toXfdfY(normY: number, pageHeight: number): number {
  // KPDF: origin top-left, Y increases downward
  // XFDF/PDF: origin bottom-left, Y increases upward
  return (1 - normY) * pageHeight;
}

function fromXfdfX(pdfX: number, pageWidth: number): number {
  return pdfX / pageWidth;
}

function fromXfdfY(pdfY: number, pageHeight: number): number {
  return 1 - pdfY / pageHeight;
}

function toXfdfRect(
  x: number, y: number, w: number, h: number,
  pageWidth: number, pageHeight: number,
): string {
  const left = toXfdfX(x, pageWidth);
  const bottom = toXfdfY(y + h, pageHeight);
  const right = toXfdfX(x + w, pageWidth);
  const top = toXfdfY(y, pageHeight);
  return `${fmt(left)},${fmt(bottom)},${fmt(right)},${fmt(top)}`;
}

function parseRect(rect: string, pageWidth: number, pageHeight: number): { x: number; y: number; width: number; height: number } {
  const [left, bottom, right, top] = rect.split(',').map(Number);
  const x = fromXfdfX(left, pageWidth);
  const y = fromXfdfY(top, pageHeight);
  const width = fromXfdfX(right - left, pageWidth);
  const height = fromXfdfY(bottom, pageHeight) - fromXfdfY(top, pageHeight);
  return { x, y, width: Math.abs(width), height: Math.abs(height) };
}

function fmt(n: number): string {
  return n.toFixed(4);
}

function colorToHex(color: string): string {
  // Accept #rrggbb format; XFDF uses #RRGGBB
  return color.startsWith('#') ? color.toUpperCase() : `#${color.toUpperCase()}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Export ──────────────────────────────────────────────────────────────

function annotationToXfdf(
  ann: Annotation,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
): string {
  const page = `page="${pageIndex}"`;
  const color = `color="${colorToHex(ann.color)}"`;
  const name = `name="${escapeXml(ann.id)}"`;
  const date = `date="${ann.updatedAt}"`;
  const creationDate = `creationdate="${ann.createdAt}"`;
  const subject = `subject="${escapeXml(ann.type)}"`;
  const title = `title="${escapeXml(ann.author)}"`;
  const common = `${name} ${page} ${color} ${date} ${creationDate} ${subject} ${title}`;

  switch (ann.type) {
    case 'pen': {
      const rect = computeInkRect(ann.points, pageWidth, pageHeight);
      const inklist = ann.points
        .map((p) => `${fmt(toXfdfX(p.x, pageWidth))},${fmt(toXfdfY(p.y, pageHeight))}`)
        .join(';');
      return `<ink ${common} rect="${rect}" width="${fmt(ann.thickness * pageWidth)}"><inklist><gesture>${inklist}</gesture></inklist></ink>`;
    }

    case 'rectangle': {
      const rect = toXfdfRect(ann.x, ann.y, ann.width, ann.height, pageWidth, pageHeight);
      return `<square ${common} rect="${rect}" width="${fmt(ann.thickness * pageWidth)}" />`;
    }

    case 'highlight': {
      const rect = toXfdfRect(ann.x, ann.y, ann.width, ann.height, pageWidth, pageHeight);
      // Highlight uses quadpoints: 8 values for the quad
      const left = toXfdfX(ann.x, pageWidth);
      const right = toXfdfX(ann.x + ann.width, pageWidth);
      const top = toXfdfY(ann.y, pageHeight);
      const bottom = toXfdfY(ann.y + ann.height, pageHeight);
      const quads = `${fmt(left)},${fmt(top)},${fmt(right)},${fmt(top)},${fmt(left)},${fmt(bottom)},${fmt(right)},${fmt(bottom)}`;
      return `<highlight ${common} rect="${rect}" coords="${quads}" />`;
    }

    case 'text': {
      const textX = toXfdfX(ann.x, pageWidth);
      const textY = toXfdfY(ann.y, pageHeight);
      const fontSize = ann.fontSize * pageWidth;
      const textHeight = fontSize * 1.5;
      const textWidth = ann.text.length * fontSize * 0.6;
      const rect = `${fmt(textX)},${fmt(textY - textHeight)},${fmt(textX + textWidth)},${fmt(textY)}`;
      return `<freetext ${common} rect="${rect}" size="${fmt(fontSize)}">${escapeXml(ann.text)}</freetext>`;
    }

    case 'arrow': {
      const x1 = toXfdfX(ann.start.x, pageWidth);
      const y1 = toXfdfY(ann.start.y, pageHeight);
      const x2 = toXfdfX(ann.end.x, pageWidth);
      const y2 = toXfdfY(ann.end.y, pageHeight);
      const rect = `${fmt(Math.min(x1, x2))},${fmt(Math.min(y1, y2))},${fmt(Math.max(x1, x2))},${fmt(Math.max(y1, y2))}`;
      return `<line ${common} rect="${rect}" start="${fmt(x1)},${fmt(y1)}" end="${fmt(x2)},${fmt(y2)}" width="${fmt(ann.thickness * pageWidth)}" head="OpenArrow" tail="None" />`;
    }

    case 'stamp': {
      const rect = toXfdfRect(ann.x, ann.y, ann.width, ann.height, pageWidth, pageHeight);
      return `<stamp ${common} rect="${rect}" icon="${escapeXml(ann.stampId)}">${escapeXml(ann.label)}</stamp>`;
    }

    case 'polygon': {
      if (ann.points.length === 0) return '';
      const rect = computeInkRect(ann.points, pageWidth, pageHeight);
      const vertices = ann.points
        .map((p) => `${fmt(toXfdfX(p.x, pageWidth))},${fmt(toXfdfY(p.y, pageHeight))}`)
        .join(';');
      const tag = ann.closed ? 'polygon' : 'polyline';
      return `<${tag} ${common} rect="${rect}" width="${fmt(ann.thickness * pageWidth)}" vertices="${vertices}" />`;
    }

    case 'callout': {
      const box = ann.box;
      const rect = toXfdfRect(box.x, box.y, box.width, box.height, pageWidth, pageHeight);
      const fontSize = ann.fontSize * pageWidth;
      return `<freetext ${common} rect="${rect}" size="${fmt(fontSize)}" callout="true">${escapeXml(ann.text)}</freetext>`;
    }

    case 'cloud': {
      const rect = toXfdfRect(ann.x, ann.y, ann.width, ann.height, pageWidth, pageHeight);
      return `<square ${common} rect="${rect}" style="cloudy" />`;
    }

    case 'measurement': {
      const x1 = toXfdfX(ann.start.x, pageWidth);
      const y1 = toXfdfY(ann.start.y, pageHeight);
      const x2 = toXfdfX(ann.end.x, pageWidth);
      const y2 = toXfdfY(ann.end.y, pageHeight);
      const rect = `${fmt(Math.min(x1, x2))},${fmt(Math.min(y1, y2))},${fmt(Math.max(x1, x2))},${fmt(Math.max(y1, y2))}`;
      return `<line ${common} rect="${rect}" start="${fmt(x1)},${fmt(y1)}" end="${fmt(x2)},${fmt(y2)}" width="${fmt(ann.thickness * pageWidth)}" measure="true" scale="${ann.scale}" unit="${escapeXml(ann.unit)}" />`;
    }

    case 'hyperlink': {
      const rect = toXfdfRect(ann.x, ann.y, ann.width, ann.height, pageWidth, pageHeight);
      return `<link ${common} rect="${rect}" dest="${ann.targetPage}">${escapeXml(ann.label)}</link>`;
    }

    default:
      return '';
  }
}

function computeInkRect(points: Point[], pageWidth: number, pageHeight: number): string {
  if (points.length === 0) return '0,0,0,0';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    const px = toXfdfX(p.x, pageWidth);
    const py = toXfdfY(p.y, pageHeight);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return `${fmt(minX)},${fmt(minY)},${fmt(maxX)},${fmt(maxY)}`;
}

/**
 * Export KPDF annotations to XFDF XML string.
 *
 * @param annotationsByPage - Annotations grouped by 1-based page number
 * @param sourceFingerprint - Optional PDF fingerprint for the <f> element
 * @param pageWidth - PDF page width in points (default: 612)
 * @param pageHeight - PDF page height in points (default: 792)
 * @returns XFDF XML string
 */
export function exportToXfdf(
  annotationsByPage: AnnotationsByPage,
  sourceFingerprint?: string,
  pageWidth: number = DEFAULT_PAGE_WIDTH,
  pageHeight: number = DEFAULT_PAGE_HEIGHT,
): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">');

  if (sourceFingerprint) {
    lines.push(`  <f href="${escapeXml(sourceFingerprint)}" />`);
  }

  lines.push('  <annots>');

  const sortedPages = Object.keys(annotationsByPage).map(Number).sort((a, b) => a - b);

  for (const pageNum of sortedPages) {
    const annotations = annotationsByPage[pageNum] ?? [];
    const pageIndex = pageNum - 1; // XFDF uses 0-based page index

    for (const ann of annotations) {
      const xml = annotationToXfdf(ann, pageIndex, pageWidth, pageHeight);
      if (xml) {
        lines.push(`    ${xml}`);
      }
    }
  }

  lines.push('  </annots>');
  lines.push('</xfdf>');

  return lines.join('\n');
}

// ── Import ──────────────────────────────────────────────────────────────

/**
 * Parse XFDF XML string back to KPDF annotations.
 *
 * Uses basic XML parsing (no DOMParser dependency for Node/test compatibility).
 *
 * @param xfdfString - XFDF XML string
 * @param pageWidth - PDF page width in points (default: 612)
 * @param pageHeight - PDF page height in points (default: 792)
 * @returns AnnotationsByPage
 */
export function importFromXfdf(
  xfdfString: string,
  pageWidth: number = DEFAULT_PAGE_WIDTH,
  pageHeight: number = DEFAULT_PAGE_HEIGHT,
): AnnotationsByPage {
  const result: AnnotationsByPage = {};

  // Parse each annotation element
  const annotElements = extractAnnotElements(xfdfString);

  for (const elem of annotElements) {
    const ann = parseAnnotElement(elem, pageWidth, pageHeight);
    if (!ann) continue;

    const pageNum = ann.pageNum;
    if (!result[pageNum]) result[pageNum] = [];
    result[pageNum].push(ann.annotation);
  }

  return result;
}

type ParsedElement = {
  tag: string;
  attrs: Record<string, string>;
  content: string;
};

function extractAnnotElements(xfdf: string): ParsedElement[] {
  const elements: ParsedElement[] = [];

  // Match both self-closing and content elements
  const tagNames = ['ink', 'square', 'highlight', 'freetext', 'line', 'stamp', 'polygon', 'polyline', 'circle', 'link'];

  for (const tag of tagNames) {
    // Self-closing: <tag ... />
    const selfClosingRe = new RegExp(`<${tag}\\s([^>]*?)\\s*/>`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = selfClosingRe.exec(xfdf)) !== null) {
      elements.push({ tag, attrs: parseAttrs(m[1]), content: '' });
    }

    // Content: <tag ...>content</tag>
    const contentRe = new RegExp(`<${tag}\\s([^>]*?)>([\\s\\S]*?)</${tag}>`, 'gi');
    while ((m = contentRe.exec(xfdf)) !== null) {
      elements.push({ tag, attrs: parseAttrs(m[1]), content: m[2].trim() });
    }
  }

  return elements;
}

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function makeBaseAnnotation(attrs: Record<string, string>): {
  id: string;
  zIndex: number;
  color: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  locked: boolean;
} {
  return {
    id: attrs['name'] || randomId(),
    zIndex: 1,
    color: (attrs['color'] || '#000000').toLowerCase(),
    author: unescapeXml(attrs['title'] || 'unknown'),
    createdAt: attrs['creationdate'] || new Date().toISOString(),
    updatedAt: attrs['date'] || new Date().toISOString(),
    locked: false,
  };
}

function parseAnnotElement(
  elem: ParsedElement,
  pageWidth: number,
  pageHeight: number,
): { pageNum: number; annotation: Annotation } | null {
  const { tag, attrs, content } = elem;
  const pageIndex = Number(attrs['page'] || '0');
  const pageNum = pageIndex + 1;
  const base = makeBaseAnnotation(attrs);

  switch (tag) {
    case 'ink': {
      // Parse inklist gestures
      const gestureMatch = content.match(/<gesture>([\s\S]*?)<\/gesture>/);
      if (!gestureMatch) return null;
      const pointStrs = gestureMatch[1].split(';');
      const points: Point[] = pointStrs.map((ps) => {
        const [x, y] = ps.split(',').map(Number);
        return { x: fromXfdfX(x, pageWidth), y: fromXfdfY(y, pageHeight) };
      });
      const thickness = Number(attrs['width'] || '1') / pageWidth;
      return {
        pageNum,
        annotation: { ...base, type: 'pen', points, thickness },
      };
    }

    case 'square': {
      if (!attrs['rect']) return null;
      const { x, y, width, height } = parseRect(attrs['rect'], pageWidth, pageHeight);
      const style = attrs['style'] || '';
      if (style === 'cloudy') {
        return {
          pageNum,
          annotation: { ...base, type: 'cloud', x, y, width, height },
        };
      }
      const thickness = Number(attrs['width'] || '1') / pageWidth;
      return {
        pageNum,
        annotation: { ...base, type: 'rectangle', x, y, width, height, thickness },
      };
    }

    case 'highlight': {
      if (!attrs['rect']) return null;
      const { x, y, width, height } = parseRect(attrs['rect'], pageWidth, pageHeight);
      return {
        pageNum,
        annotation: { ...base, type: 'highlight', x, y, width, height, thickness: 0 },
      };
    }

    case 'freetext': {
      if (!attrs['rect']) return null;
      const { x, y } = parseRect(attrs['rect'], pageWidth, pageHeight);
      const fontSize = Number(attrs['size'] || '12') / pageWidth;
      const text = unescapeXml(content);
      return {
        pageNum,
        annotation: { ...base, type: 'text', x, y, text, fontSize },
      };
    }

    case 'line': {
      const startParts = (attrs['start'] || '0,0').split(',').map(Number);
      const endParts = (attrs['end'] || '0,0').split(',').map(Number);
      const start: Point = { x: fromXfdfX(startParts[0], pageWidth), y: fromXfdfY(startParts[1], pageHeight) };
      const end: Point = { x: fromXfdfX(endParts[0], pageWidth), y: fromXfdfY(endParts[1], pageHeight) };
      const thickness = Number(attrs['width'] || '1') / pageWidth;

      if (attrs['measure'] === 'true') {
        const scale = Number(attrs['scale'] || '1');
        const unit = unescapeXml(attrs['unit'] || 'ft');
        return {
          pageNum,
          annotation: { ...base, type: 'measurement', start, end, thickness, scale, unit },
        };
      }

      // Arrow
      const headSize = 0.012; // default normalized head size
      return {
        pageNum,
        annotation: { ...base, type: 'arrow', start, end, thickness, headSize },
      };
    }

    case 'stamp': {
      if (!attrs['rect']) return null;
      const { x, y, width, height } = parseRect(attrs['rect'], pageWidth, pageHeight);
      const stampId = unescapeXml(attrs['icon'] || 'custom');
      const label = unescapeXml(content) || stampId;
      return {
        pageNum,
        annotation: { ...base, type: 'stamp', x, y, width, height, stampId, label },
      };
    }

    case 'polygon':
    case 'polyline': {
      const vertexStr = attrs['vertices'] || '';
      if (!vertexStr) return null;
      const points: Point[] = vertexStr.split(';').map((vs) => {
        const [x, y] = vs.split(',').map(Number);
        return { x: fromXfdfX(x, pageWidth), y: fromXfdfY(y, pageHeight) };
      });
      const thickness = Number(attrs['width'] || '1') / pageWidth;
      return {
        pageNum,
        annotation: { ...base, type: 'polygon', points, closed: tag === 'polygon', thickness },
      };
    }

    case 'circle': {
      // Map to rectangle with type 'rectangle' as closest match (no ellipse in current types)
      if (!attrs['rect']) return null;
      const { x, y, width, height } = parseRect(attrs['rect'], pageWidth, pageHeight);
      const thickness = Number(attrs['width'] || '1') / pageWidth;
      return {
        pageNum,
        annotation: { ...base, type: 'rectangle', x, y, width, height, thickness },
      };
    }

    case 'link': {
      if (!attrs['rect']) return null;
      const { x, y, width, height } = parseRect(attrs['rect'], pageWidth, pageHeight);
      const targetPage = Number(attrs['dest'] || '1');
      const label = unescapeXml(content) || 'Link';
      return {
        pageNum,
        annotation: { ...base, type: 'hyperlink', x, y, width, height, targetPage, label },
      };
    }

    default:
      return null;
  }
}
