import type { AnnotationsByPage } from '../types';

export type ReportRow = {
  page: number;
  type: string;
  author: string;
  color: string;
  comment: string;
  status: string;
  createdAt: string;
  locked: boolean;
};

/**
 * Generate report rows from annotations.
 */
export function generateReportRows(annotationsByPage: AnnotationsByPage): ReportRow[] {
  const rows: ReportRow[] = [];

  for (const [pageStr, annotations] of Object.entries(annotationsByPage)) {
    const page = Number(pageStr);
    for (const ann of annotations) {
      rows.push({
        page,
        type: ann.type,
        author: ann.author,
        color: ann.color,
        comment: ann.comment ?? '',
        status: ann.status ?? '',
        createdAt: ann.createdAt,
        locked: ann.locked,
      });
    }
  }

  return rows.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Convert report rows to CSV string.
 */
export function toCSV(rows: ReportRow[]): string {
  const headers = ['Page', 'Type', 'Author', 'Color', 'Comment', 'Status', 'Created At', 'Locked'];
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = [
      String(row.page),
      row.type,
      escapeCsvField(row.author),
      row.color,
      escapeCsvField(row.comment),
      row.status,
      row.createdAt,
      String(row.locked),
    ];
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Download CSV file in the browser.
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate summary statistics.
 */
export function generateSummary(rows: ReportRow[]): {
  totalAnnotations: number;
  byType: Record<string, number>;
  byAuthor: Record<string, number>;
  byStatus: Record<string, number>;
  pageCount: number;
} {
  const byType: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const pages = new Set<number>();

  for (const row of rows) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
    byAuthor[row.author] = (byAuthor[row.author] ?? 0) + 1;
    if (row.status) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    pages.add(row.page);
  }

  return {
    totalAnnotations: rows.length,
    byType,
    byAuthor,
    byStatus,
    pageCount: pages.size,
  };
}
