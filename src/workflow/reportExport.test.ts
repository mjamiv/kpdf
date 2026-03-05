import { describe, it, expect } from 'vitest';
import { generateReportRows, toCSV, generateSummary, type ReportRow } from './reportExport';
import type { AnnotationsByPage } from '../types';

const makeAnnotation = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-1',
  zIndex: 1,
  color: '#ff0000',
  author: 'tester',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  locked: false,
  type: 'rectangle' as const,
  x: 0.1, y: 0.1, width: 0.2, height: 0.2, thickness: 0.0025,
  ...overrides,
});

describe('generateReportRows', () => {
  it('extracts rows from all pages', () => {
    const annotations: AnnotationsByPage = {
      1: [makeAnnotation({ id: 'a1' })],
      2: [makeAnnotation({ id: 'a2' }), makeAnnotation({ id: 'a3' })],
    };
    const rows = generateReportRows(annotations);
    expect(rows).toHaveLength(3);
    expect(rows[0].page).toBe(1);
    expect(rows[1].page).toBe(2);
  });

  it('handles empty annotations', () => {
    expect(generateReportRows({})).toHaveLength(0);
  });
});

describe('toCSV', () => {
  it('generates valid CSV with headers', () => {
    const rows: ReportRow[] = [{
      page: 1, type: 'rectangle', author: 'tester', color: '#ff0000',
      comment: '', status: '', createdAt: '2024-01-01T00:00:00Z', locked: false,
    }];
    const csv = toCSV(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Page,Type,Author,Color,Comment,Status,Created At,Locked,Measurement');
    expect(lines[1]).toContain('rectangle');
    expect(lines[1]).toContain('tester');
  });

  it('escapes fields with commas', () => {
    const rows: ReportRow[] = [{
      page: 1, type: 'text', author: 'Smith, John', color: '#000',
      comment: 'Has, commas', status: '', createdAt: '2024-01-01T00:00:00Z', locked: false,
    }];
    const csv = toCSV(rows);
    expect(csv).toContain('"Smith, John"');
    expect(csv).toContain('"Has, commas"');
  });

  it('escapes fields with quotes', () => {
    const rows: ReportRow[] = [{
      page: 1, type: 'text', author: 'test', color: '#000',
      comment: 'He said "hello"', status: '', createdAt: '2024-01-01T00:00:00Z', locked: false,
    }];
    const csv = toCSV(rows);
    expect(csv).toContain('"He said ""hello"""');
  });
});

describe('generateSummary', () => {
  it('computes statistics', () => {
    const rows: ReportRow[] = [
      { page: 1, type: 'rectangle', author: 'a', color: '#f00', comment: '', status: 'open', createdAt: '', locked: false },
      { page: 1, type: 'pen', author: 'a', color: '#f00', comment: '', status: 'open', createdAt: '', locked: false },
      { page: 2, type: 'rectangle', author: 'b', color: '#f00', comment: '', status: 'resolved', createdAt: '', locked: false },
    ];
    const summary = generateSummary(rows);
    expect(summary.totalAnnotations).toBe(3);
    expect(summary.byType.rectangle).toBe(2);
    expect(summary.byType.pen).toBe(1);
    expect(summary.byAuthor.a).toBe(2);
    expect(summary.byAuthor.b).toBe(1);
    expect(summary.byStatus.open).toBe(2);
    expect(summary.byStatus.resolved).toBe(1);
    expect(summary.pageCount).toBe(2);
  });
});
