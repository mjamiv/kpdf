import { describe, it, expect } from 'vitest';
import { generateReportRows, toCSV } from '../workflow/reportExport';
import type { Annotation, AnnotationsByPage } from '../types';

const makeAnn = (overrides: Partial<Annotation> & { id: string; type: Annotation['type'] }): Annotation => ({
  zIndex: 1,
  color: '#ff0000',
  author: 'tester',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  locked: false,
  comment: 'Test comment',
  status: 'open',
  x: 0.1,
  y: 0.1,
  width: 0.2,
  height: 0.2,
  thickness: 0.002,
  ...overrides,
} as Annotation);

describe('MarkupsList data helpers', () => {
  const annotations: AnnotationsByPage = {
    1: [
      makeAnn({ id: 'a1', type: 'rectangle', author: 'Alice', comment: 'Fix wall' }),
      makeAnn({ id: 'a2', type: 'rectangle', author: 'Bob', status: 'resolved', comment: 'OK' }),
    ],
    2: [
      makeAnn({ id: 'a3', type: 'rectangle', author: 'Alice', comment: 'Check door', status: 'rejected' }),
    ],
  };

  it('generates rows for all annotations across pages', () => {
    const rows = generateReportRows(annotations);
    expect(rows).toHaveLength(3);
    expect(rows[0].page).toBe(1);
    expect(rows[2].page).toBe(2);
  });

  it('sorts rows by page then createdAt', () => {
    const ann: AnnotationsByPage = {
      2: [makeAnn({ id: 'b1', type: 'rectangle', createdAt: '2024-01-01' })],
      1: [makeAnn({ id: 'a1', type: 'rectangle', createdAt: '2024-01-02' })],
    };
    const rows = generateReportRows(ann);
    expect(rows[0].page).toBe(1);
    expect(rows[1].page).toBe(2);
  });

  it('CSV export includes all headers including Measurement', () => {
    const rows = generateReportRows(annotations);
    const csv = toCSV(rows);
    const header = csv.split('\n')[0];
    expect(header).toContain('Measurement');
    expect(header).toContain('Page');
    expect(header).toContain('Type');
    expect(header).toContain('Author');
  });

  it('CSV export generates correct number of data rows', () => {
    const rows = generateReportRows(annotations);
    const csv = toCSV(rows);
    const lines = csv.split('\n');
    // 1 header + 3 data rows
    expect(lines).toHaveLength(4);
  });

  it('filters by status in report rows', () => {
    const rows = generateReportRows(annotations);
    const openRows = rows.filter((r) => r.status === 'open');
    expect(openRows).toHaveLength(1);
    const resolvedRows = rows.filter((r) => r.status === 'resolved');
    expect(resolvedRows).toHaveLength(1);
  });

  it('filters by type in report rows', () => {
    const mixed: AnnotationsByPage = {
      1: [
        makeAnn({ id: 'a1', type: 'rectangle' }),
        { ...makeAnn({ id: 'a2', type: 'pen' as 'rectangle' }), type: 'pen', points: [{ x: 0, y: 0 }] } as Annotation,
      ],
    };
    const rows = generateReportRows(mixed);
    const rectRows = rows.filter((r) => r.type === 'rectangle');
    expect(rectRows).toHaveLength(1);
    const penRows = rows.filter((r) => r.type === 'pen');
    expect(penRows).toHaveLength(1);
  });

  it('measurement field is computed for measurement annotations', () => {
    const measAnn: AnnotationsByPage = {
      1: [{
        id: 'm1',
        type: 'measurement' as const,
        zIndex: 1,
        color: '#000',
        author: 'tester',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        locked: false,
        start: { x: 0, y: 0 },
        end: { x: 0.3, y: 0.4 },
        thickness: 0.002,
        scale: 100,
        unit: 'ft',
      }],
    };
    const rows = generateReportRows(measAnn);
    expect(rows[0].measurement).toBeDefined();
    expect(rows[0].measurement).toContain('ft');
  });

  it('measurement field is undefined for non-measurement annotations', () => {
    const rows = generateReportRows(annotations);
    for (const row of rows) {
      expect(row.measurement).toBeUndefined();
    }
  });
});
