import type { Annotation, AnnotationsByPage } from '../types';

export type ReportRow = {
  page: number;
  type: string;
  author: string;
  color: string;
  comment: string;
  status: string;
  createdAt: string;
  locked: boolean;
  measurement?: string;
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
        measurement: computeMeasurement(ann),
      });
    }
  }

  return rows.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function computeMeasurement(ann: Annotation): string | undefined {
  if (ann.type === 'measurement' || ann.type === 'dimension') {
    const dx = ann.end.x - ann.start.x;
    const dy = ann.end.y - ann.start.y;
    const dist = Math.sqrt(dx * dx + dy * dy) * ann.scale;
    return `${dist.toFixed(2)} ${ann.unit}`;
  }
  if (ann.type === 'area') {
    // Shoelace formula on normalized coords, scaled
    let area = 0;
    const pts = ann.points;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    area = Math.abs(area / 2) * ann.scale * ann.scale;
    // Perimeter
    let perimeter = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      perimeter += Math.sqrt((pts[j].x - pts[i].x) ** 2 + (pts[j].y - pts[i].y) ** 2);
    }
    perimeter *= ann.scale;
    return `Area: ${area.toFixed(2)} ${ann.unit}\u00B2, Perimeter: ${perimeter.toFixed(2)} ${ann.unit}`;
  }
  if (ann.type === 'angle') {
    const v1 = { x: ann.ray1.x - ann.vertex.x, y: ann.ray1.y - ann.vertex.y };
    const v2 = { x: ann.ray2.x - ann.vertex.x, y: ann.ray2.y - ann.vertex.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const m1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const m2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (m1 > 0 && m2 > 0) {
      const angle = Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2)))) * (180 / Math.PI);
      return `${angle.toFixed(1)}\u00B0`;
    }
  }
  return undefined;
}

/**
 * Convert report rows to CSV string.
 */
export function toCSV(rows: ReportRow[]): string {
  const headers = ['Page', 'Type', 'Author', 'Color', 'Comment', 'Status', 'Created At', 'Locked', 'Measurement'];
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
      escapeCsvField(row.measurement ?? ''),
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
