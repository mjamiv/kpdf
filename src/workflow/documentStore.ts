import type { AnnotationsByPage, PageScale } from '../types';

export type DocumentTab = {
  id: string;
  fileName: string;
  fingerprint: string;
  pageNumber: number;
  pageCount: number;
  zoom: number;
  fitMode: 'manual' | 'width' | 'page';
  panX: number;
  panY: number;
  annotationsByPage: AnnotationsByPage;
  dirty: boolean;
  pageScales: Record<number, PageScale>;
};

export function createDocumentTab(
  id: string,
  fileName: string,
  fingerprint: string,
  pageCount: number,
): DocumentTab {
  return {
    id,
    fileName,
    fingerprint,
    pageNumber: 1,
    pageCount,
    zoom: 1,
    fitMode: 'manual',
    panX: 0,
    panY: 0,
    annotationsByPage: {},
    dirty: false,
    pageScales: {},
  };
}

