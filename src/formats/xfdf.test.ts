import { describe, it, expect } from 'vitest';
import { exportToXfdf, importFromXfdf } from './xfdf';
import type { AnnotationsByPage, Annotation } from '../types';

function makePen(): Annotation {
  return {
    id: 'pen-1',
    type: 'pen',
    zIndex: 1,
    color: '#ff0000',
    author: 'Alice',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    locked: false,
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.4 },
      { x: 0.5, y: 0.6 },
    ],
    thickness: 0.002,
  };
}

function makeRect(): Annotation {
  return {
    id: 'rect-1',
    type: 'rectangle',
    zIndex: 2,
    color: '#0000ff',
    author: 'Bob',
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z',
    locked: false,
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.4,
    thickness: 0.003,
  };
}

function makeArrow(): Annotation {
  return {
    id: 'arrow-1',
    type: 'arrow',
    zIndex: 3,
    color: '#00ff00',
    author: 'Carol',
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-03-01T00:00:00.000Z',
    locked: false,
    start: { x: 0.1, y: 0.2 },
    end: { x: 0.5, y: 0.6 },
    thickness: 0.002,
    headSize: 0.012,
  };
}

function makeStamp(): Annotation {
  return {
    id: 'stamp-1',
    type: 'stamp',
    zIndex: 4,
    color: '#16a34a',
    author: 'Dave',
    createdAt: '2024-04-01T00:00:00.000Z',
    updatedAt: '2024-04-01T00:00:00.000Z',
    locked: false,
    x: 0.2,
    y: 0.3,
    width: 0.08,
    height: 0.04,
    stampId: 'approved',
    label: 'APPROVED',
  };
}

function makeText(): Annotation {
  return {
    id: 'text-1',
    type: 'text',
    zIndex: 5,
    color: '#000000',
    author: 'Eve',
    createdAt: '2024-05-01T00:00:00.000Z',
    updatedAt: '2024-05-01T00:00:00.000Z',
    locked: false,
    x: 0.1,
    y: 0.2,
    text: 'Hello World',
    fontSize: 0.02,
  };
}

function makeHighlight(): Annotation {
  return {
    id: 'hl-1',
    type: 'highlight',
    zIndex: 6,
    color: '#ffff00',
    author: 'Frank',
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
    locked: false,
    x: 0.1,
    y: 0.2,
    width: 0.5,
    height: 0.05,
    thickness: 0,
  };
}

function makePolygon(): Annotation {
  return {
    id: 'poly-1',
    type: 'polygon',
    zIndex: 7,
    color: '#ff00ff',
    author: 'Grace',
    createdAt: '2024-07-01T00:00:00.000Z',
    updatedAt: '2024-07-01T00:00:00.000Z',
    locked: false,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.2, y: 0.3 },
    ],
    closed: true,
    thickness: 0.002,
  };
}

describe('exportToXfdf', () => {
  it('produces valid XML structure', () => {
    const annotations: AnnotationsByPage = { 1: [makePen()] };
    const xml = exportToXfdf(annotations);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<xfdf');
    expect(xml).toContain('<annots>');
    expect(xml).toContain('</annots>');
    expect(xml).toContain('</xfdf>');
  });

  it('includes source fingerprint when provided', () => {
    const annotations: AnnotationsByPage = {};
    const xml = exportToXfdf(annotations, 'abc123');
    expect(xml).toContain('<f href="abc123"');
  });

  it('exports pen as ink element', () => {
    const xml = exportToXfdf({ 1: [makePen()] });
    expect(xml).toContain('<ink');
    expect(xml).toContain('<gesture>');
  });

  it('exports rectangle as square element', () => {
    const xml = exportToXfdf({ 1: [makeRect()] });
    expect(xml).toContain('<square');
    expect(xml).toContain('rect=');
  });

  it('exports arrow as line element', () => {
    const xml = exportToXfdf({ 1: [makeArrow()] });
    expect(xml).toContain('<line');
    expect(xml).toContain('head="OpenArrow"');
  });

  it('exports stamp element', () => {
    const xml = exportToXfdf({ 1: [makeStamp()] });
    expect(xml).toContain('<stamp');
    expect(xml).toContain('icon="approved"');
    expect(xml).toContain('APPROVED');
  });

  it('exports text as freetext element', () => {
    const xml = exportToXfdf({ 1: [makeText()] });
    expect(xml).toContain('<freetext');
    expect(xml).toContain('Hello World');
  });

  it('exports highlight element', () => {
    const xml = exportToXfdf({ 1: [makeHighlight()] });
    expect(xml).toContain('<highlight');
    expect(xml).toContain('coords=');
  });

  it('exports polygon element', () => {
    const xml = exportToXfdf({ 1: [makePolygon()] });
    expect(xml).toContain('<polygon');
    expect(xml).toContain('vertices=');
  });

  it('uses 0-based page index in XFDF', () => {
    const xml = exportToXfdf({ 1: [makePen()] });
    expect(xml).toContain('page="0"');
  });

  it('preserves annotation ID as name attribute', () => {
    const xml = exportToXfdf({ 1: [makePen()] });
    expect(xml).toContain('name="pen-1"');
  });

  it('preserves author as title attribute', () => {
    const xml = exportToXfdf({ 1: [makePen()] });
    expect(xml).toContain('title="Alice"');
  });

  it('handles multiple pages', () => {
    const annotations: AnnotationsByPage = {
      1: [makePen()],
      3: [makeRect()],
    };
    const xml = exportToXfdf(annotations);
    expect(xml).toContain('page="0"');
    expect(xml).toContain('page="2"');
  });

  it('escapes XML special characters', () => {
    const text: Annotation = {
      ...makeText(),
      type: 'text',
      text: 'A < B & C > D',
    } as Annotation;
    const xml = exportToXfdf({ 1: [text] });
    expect(xml).toContain('A &lt; B &amp; C &gt; D');
  });
});

describe('importFromXfdf', () => {
  it('round-trips pen annotations', () => {
    const original: AnnotationsByPage = { 1: [makePen()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    const ann = imported[1]![0];
    expect(ann.type).toBe('pen');
    if (ann.type === 'pen') {
      expect(ann.points).toHaveLength(3);
      // Check approximate coordinate preservation
      expect(ann.points[0].x).toBeCloseTo(0.1, 2);
      expect(ann.points[0].y).toBeCloseTo(0.2, 2);
    }
  });

  it('round-trips rectangle annotations', () => {
    const original: AnnotationsByPage = { 1: [makeRect()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    expect(imported[1]![0].type).toBe('rectangle');
    if (imported[1]![0].type === 'rectangle') {
      expect(imported[1]![0].x).toBeCloseTo(0.1, 2);
      expect(imported[1]![0].y).toBeCloseTo(0.2, 2);
      expect(imported[1]![0].width).toBeCloseTo(0.3, 2);
      expect(imported[1]![0].height).toBeCloseTo(0.4, 2);
    }
  });

  it('round-trips arrow annotations', () => {
    const original: AnnotationsByPage = { 1: [makeArrow()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    expect(imported[1]![0].type).toBe('arrow');
    if (imported[1]![0].type === 'arrow') {
      expect(imported[1]![0].start.x).toBeCloseTo(0.1, 2);
      expect(imported[1]![0].end.x).toBeCloseTo(0.5, 2);
    }
  });

  it('round-trips stamp annotations', () => {
    const original: AnnotationsByPage = { 1: [makeStamp()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    expect(imported[1]![0].type).toBe('stamp');
    if (imported[1]![0].type === 'stamp') {
      expect(imported[1]![0].stampId).toBe('approved');
      expect(imported[1]![0].label).toBe('APPROVED');
    }
  });

  it('round-trips text annotations', () => {
    const original: AnnotationsByPage = { 1: [makeText()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    expect(imported[1]![0].type).toBe('text');
    if (imported[1]![0].type === 'text') {
      expect(imported[1]![0].text).toBe('Hello World');
    }
  });

  it('round-trips highlight annotations', () => {
    const original: AnnotationsByPage = { 1: [makeHighlight()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    expect(imported[1]![0].type).toBe('highlight');
  });

  it('round-trips polygon annotations', () => {
    const original: AnnotationsByPage = { 1: [makePolygon()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(1);
    expect(imported[1]![0].type).toBe('polygon');
    if (imported[1]![0].type === 'polygon') {
      expect(imported[1]![0].points).toHaveLength(3);
      expect(imported[1]![0].closed).toBe(true);
    }
  });

  it('preserves annotation IDs', () => {
    const original: AnnotationsByPage = { 1: [makePen()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);
    expect(imported[1]![0].id).toBe('pen-1');
  });

  it('preserves colors', () => {
    const original: AnnotationsByPage = { 1: [makePen()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);
    expect(imported[1]![0].color).toBe('#ff0000');
  });

  it('preserves authors', () => {
    const original: AnnotationsByPage = { 1: [makePen()] };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);
    expect(imported[1]![0].author).toBe('Alice');
  });

  it('handles multiple annotations on multiple pages', () => {
    const original: AnnotationsByPage = {
      1: [makePen(), makeRect()],
      2: [makeArrow()],
    };
    const xml = exportToXfdf(original);
    const imported = importFromXfdf(xml);

    expect(imported[1]).toHaveLength(2);
    expect(imported[2]).toHaveLength(1);
  });

  it('returns empty result for empty XFDF', () => {
    const xml = '<?xml version="1.0"?><xfdf xmlns="http://ns.adobe.com/xfdf/"><annots></annots></xfdf>';
    const imported = importFromXfdf(xml);
    expect(Object.keys(imported)).toHaveLength(0);
  });

  it('handles custom page dimensions', () => {
    const original: AnnotationsByPage = { 1: [makeRect()] };
    const pageWidth = 1000;
    const pageHeight = 1000;
    const xml = exportToXfdf(original, undefined, pageWidth, pageHeight);
    const imported = importFromXfdf(xml, pageWidth, pageHeight);

    if (imported[1]![0].type === 'rectangle') {
      expect(imported[1]![0].x).toBeCloseTo(0.1, 2);
      expect(imported[1]![0].y).toBeCloseTo(0.2, 2);
    }
  });
});
