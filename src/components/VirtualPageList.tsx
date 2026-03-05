/**
 * Virtual scrolling container for PDF pages.
 *
 * Integration with App.tsx:
 * - Replace the existing page rendering loop (1..pageCount) with this component.
 * - Props:
 *   - pageCount: total number of PDF pages
 *   - currentPage: current page number (1-based)
 *   - zoom: current zoom level
 *   - renderPage: callback that renders a single page (receives 1-based page number)
 *   - onVisiblePagesChange: called when visible pages change (for prefetching, etc.)
 *   - onPageChange: called when the primary visible page changes
 *   - containerHeight: height of the scroll container in pixels
 *   - getPageHeight: returns the rendered height of a page (1-based page number)
 *
 * Example usage in App.tsx:
 *   <VirtualPageList
 *     pageCount={pageCount}
 *     currentPage={currentPage}
 *     zoom={zoom}
 *     renderPage={(pageNum) => <PageCanvas key={pageNum} page={pageNum} ... />}
 *     onVisiblePagesChange={setVisiblePages}
 *     onPageChange={setCurrentPage}
 *     containerHeight={viewportHeight}
 *     getPageHeight={(pageNum) => pageDimensions[pageNum].height * zoom + PAGE_GAP}
 *   />
 *
 * The QA agent handles wiring this into App.tsx.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useVirtualScroll } from '../hooks/useVirtualScroll';

export type VirtualPageListProps = {
  pageCount: number;
  currentPage: number;
  zoom: number;
  renderPage: (pageNum: number) => React.ReactNode;
  onVisiblePagesChange: (visiblePages: number[]) => void;
  onPageChange: (page: number) => void;
  containerHeight: number;
  getPageHeight: (pageNum: number) => number;
};

export function VirtualPageList({
  pageCount,
  currentPage,
  zoom: _zoom,
  renderPage,
  onVisiblePagesChange,
  onPageChange,
  containerHeight,
  getPageHeight,
}: VirtualPageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedPage = useRef(currentPage);

  const { visibleRange, totalHeight, scrollToItem } = useVirtualScroll({
    totalItems: pageCount,
    itemHeight: (index) => getPageHeight(index + 1), // convert 0-based to 1-based
    containerRef,
    overscan: 1,
  });

  // Report visible pages (1-based)
  useEffect(() => {
    const pages: number[] = [];
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      pages.push(i + 1); // convert to 1-based
    }
    onVisiblePagesChange(pages);

    // Update current page to the first fully visible page
    if (pages.length > 0 && pages[0] !== lastReportedPage.current) {
      lastReportedPage.current = pages[0];
      onPageChange(pages[0]);
    }
  }, [visibleRange, onVisiblePagesChange, onPageChange]);

  // Scroll to page when currentPage changes externally
  const prevCurrentPage = useRef(currentPage);
  useEffect(() => {
    if (currentPage !== prevCurrentPage.current) {
      prevCurrentPage.current = currentPage;
      scrollToItem(currentPage - 1); // convert to 0-based
    }
  }, [currentPage, scrollToItem]);

  // Compute cumulative offsets for positioning
  const getPageOffset = useCallback(
    (pageIndex: number): number => {
      let offset = 0;
      for (let i = 0; i < pageIndex; i++) {
        offset += getPageHeight(i + 1);
      }
      return offset;
    },
    [getPageHeight],
  );

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
      role="region"
      aria-label="PDF document pages"
    >
      {/* Spacer to maintain total scroll height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Render only visible pages */}
        {Array.from({ length: visibleRange.end - visibleRange.start }, (_, i) => {
          const pageIndex = visibleRange.start + i;
          const pageNum = pageIndex + 1; // 1-based
          const top = getPageOffset(pageIndex);
          const height = getPageHeight(pageNum);

          return (
            <div
              key={pageNum}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height,
              }}
              data-page={pageNum}
              role="group"
              aria-label={`Page ${pageNum} of ${pageCount}`}
            >
              {renderPage(pageNum)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
