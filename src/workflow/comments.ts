import type { Annotation } from '../types';

export type CommentFilter = {
  page?: number;
  type?: string;
  author?: string;
  status?: 'open' | 'resolved' | 'rejected';
};

export type CommentEntry = {
  annotation: Annotation;
  page: number;
};

/**
 * Extract all annotations that have comments, across all pages.
 */
export function extractComments(
  annotationsByPage: Record<number, Annotation[]>,
): CommentEntry[] {
  const entries: CommentEntry[] = [];
  for (const [pageStr, annotations] of Object.entries(annotationsByPage)) {
    const page = Number(pageStr);
    for (const ann of annotations) {
      if (ann.comment && ann.comment.trim().length > 0) {
        entries.push({ annotation: ann, page });
      }
    }
  }
  return entries.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.annotation.zIndex - b.annotation.zIndex;
  });
}

/**
 * Filter comments by criteria.
 */
export function filterComments(
  comments: CommentEntry[],
  filter: CommentFilter,
): CommentEntry[] {
  return comments.filter((entry) => {
    if (filter.page !== undefined && entry.page !== filter.page) return false;
    if (filter.type !== undefined && entry.annotation.type !== filter.type) return false;
    if (filter.author !== undefined && entry.annotation.author !== filter.author) return false;
    if (filter.status !== undefined && entry.annotation.status !== filter.status) return false;
    return true;
  });
}

/**
 * Get unique authors from comments.
 */
export function getCommentAuthors(comments: CommentEntry[]): string[] {
  return [...new Set(comments.map((c) => c.annotation.author))].sort();
}

