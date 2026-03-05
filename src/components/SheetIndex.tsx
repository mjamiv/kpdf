/**
 * SheetIndex — Panel listing all pages with extracted sheet numbers.
 *
 * Integration with App.tsx:
 *   Props:
 *     - pages: Array<{ pageIndex: number; label: string; sheetNumber: string | null }>
 *       Each entry corresponds to a PDF page. `label` is a display name (e.g. "Page 1"),
 *       `sheetNumber` is the detected AEC sheet ID (e.g. "A-101") or null.
 *     - currentPage: number — The currently active 1-based page number.
 *     - onNavigate: (pageNumber: number) => void — Callback to navigate to a page (1-based).
 *
 *   How to wire:
 *     1. Extract text from each page using src/pdf/textLayer.ts
 *     2. Run extractSheetNumber() from src/pdf/sheetDetection.ts on each page's text
 *     3. Build the `pages` array and pass to this component
 *     4. Connect onNavigate to the page-change handler in App.tsx
 */

import React, { useState, useMemo } from 'react';

export type SheetIndexEntry = {
  pageIndex: number;
  label: string;
  sheetNumber: string | null;
};

type SheetIndexProps = {
  pages: SheetIndexEntry[];
  currentPage: number;
  onNavigate: (pageNumber: number) => void;
};

const SheetIndex: React.FC<SheetIndexProps> = ({ pages, currentPage, onNavigate }) => {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return pages;
    const q = filter.trim().toLowerCase();
    return pages.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        (p.sheetNumber && p.sheetNumber.toLowerCase().includes(q)),
    );
  }, [pages, filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'sans-serif', fontSize: 13 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
        Sheet Index
      </div>

      <div style={{ padding: '6px 12px' }}>
        <input
          type="text"
          placeholder="Filter sheets..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 12,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '12px', color: '#9ca3af', textAlign: 'center' }}>
            No sheets found
          </div>
        )}
        {filtered.map((page) => {
          const pageNum = page.pageIndex + 1;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={page.pageIndex}
              onClick={() => onNavigate(pageNum)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid #f3f4f6',
                background: isActive ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
              }}
            >
              <span style={{ color: '#6b7280', minWidth: 40 }}>{page.label}</span>
              <span style={{ fontWeight: isActive ? 600 : 400, color: page.sheetNumber ? '#111827' : '#9ca3af' }}>
                {page.sheetNumber ?? 'No sheet ID'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SheetIndex;
