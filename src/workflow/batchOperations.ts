/**
 * Batch operations for multi-page annotation workflows.
 *
 * All functions are pure (no side effects) except batchFlatten and batchExportPages
 * which use dynamic import() for pdf-lib (code splitting).
 */

import type { Annotation, AnnotationsByPage, StampAnnotation } from '../types';
import { randomId } from '../engine/utils';

/**
 * Apply a stamp annotation to multiple pages.
 * Creates a copy of the stamp on each specified page with a new unique ID.
 *
 * @param annotationsByPage - Current annotations state
 * @param stamp - The stamp annotation to replicate
 * @param pages - Array of 1-based page numbers to apply the stamp to
 * @returns Updated AnnotationsByPage with the stamp added to specified pages
 */
export function batchApplyStamp(
  annotationsByPage: AnnotationsByPage,
  stamp: StampAnnotation,
  pages: number[],
): AnnotationsByPage {
  const result = { ...annotationsByPage };

  for (const page of pages) {
    const existing = result[page] ?? [];
    const maxZ = existing.reduce((max, a) => Math.max(max, a.zIndex), 0);
    const timestamp = new Date().toISOString();

    const newStamp: StampAnnotation = {
      ...stamp,
      id: randomId(),
      zIndex: maxZ + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    result[page] = [...existing, newStamp];
  }

  return result;
}

/**
 * Flatten all annotations into the PDF document.
 * Uses dynamic import for pdf-lib (code splitting).
 *
 * @param originalBytes - The original PDF file bytes
 * @param annotationsByPage - All annotations to flatten
 * @returns New PDF bytes with annotations rendered into page content
 */
export async function batchFlatten(
  originalBytes: Uint8Array,
  annotationsByPage: AnnotationsByPage,
): Promise<Uint8Array> {
  const { exportPdf } = await import('../pdfExport');
  const result = await exportPdf(originalBytes, annotationsByPage, { flatten: true });
  return result.bytes;
}

/**
 * Export individual pages as separate PDF files.
 * Uses dynamic import for pdf-lib (code splitting).
 *
 * @param originalBytes - The original PDF file bytes
 * @param pages - Array of 1-based page numbers to export
 * @returns Map from page number to individual PDF bytes
 */
export async function batchExportPages(
  originalBytes: Uint8Array,
  pages: number[],
): Promise<Map<number, Uint8Array>> {
  const { PDFDocument } = await import('pdf-lib');
  const sourcePdf = await PDFDocument.load(originalBytes);
  const result = new Map<number, Uint8Array>();

  for (const pageNum of pages) {
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) continue;

    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
    newPdf.addPage(copiedPage);
    const bytes = await newPdf.save();
    result.set(pageNum, bytes);
  }

  return result;
}

/**
 * Auto-number all annotations sequentially across pages.
 * Assigns a comment field with the number prefix + sequential index.
 *
 * @param annotationsByPage - Current annotations state
 * @param prefix - Prefix for the number (default: "#")
 * @returns Updated AnnotationsByPage with numbered annotations
 */
export function batchNumberAnnotations(
  annotationsByPage: AnnotationsByPage,
  prefix: string = '#',
): AnnotationsByPage {
  const result: AnnotationsByPage = {};
  let counter = 1;

  // Process pages in order
  const sortedPages = Object.keys(annotationsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  for (const page of sortedPages) {
    const annotations = annotationsByPage[page] ?? [];
    result[page] = annotations.map((ann) => ({
      ...ann,
      comment: `${prefix}${counter++}`,
      updatedAt: new Date().toISOString(),
    }));
  }

  return result;
}

/**
 * Bulk update the status of multiple annotations by ID.
 *
 * @param annotationsByPage - Current annotations state
 * @param ids - Array of annotation IDs to update
 * @param status - New status to set
 * @returns Updated AnnotationsByPage with changed statuses
 */
export function batchUpdateStatus(
  annotationsByPage: AnnotationsByPage,
  ids: string[],
  status: 'open' | 'resolved' | 'rejected',
): AnnotationsByPage {
  const idSet = new Set(ids);
  const result: AnnotationsByPage = {};
  const timestamp = new Date().toISOString();

  for (const [page, annotations] of Object.entries(annotationsByPage)) {
    result[Number(page)] = (annotations as Annotation[]).map((ann) => {
      if (idSet.has(ann.id)) {
        return { ...ann, status, updatedAt: timestamp };
      }
      return ann;
    });
  }

  return result;
}
