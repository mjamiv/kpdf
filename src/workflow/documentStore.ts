import type { AnnotationsByPage } from '../types';

export type DocumentTab = {
  id: string;
  fileName: string;
  fingerprint: string;
  pageNumber: number;
  pageCount: number;
  zoom: number;
  annotationsByPage: AnnotationsByPage;
  dirty: boolean;
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
    annotationsByPage: {},
    dirty: false,
  };
}

export function markDirty(tab: DocumentTab): DocumentTab {
  return tab.dirty ? tab : { ...tab, dirty: true };
}

export function markClean(tab: DocumentTab): DocumentTab {
  return !tab.dirty ? tab : { ...tab, dirty: false };
}
