import { useState } from 'react';
import SheetIndex, { type SheetIndexEntry } from './SheetIndex';

type LeftSidebarProps = {
  open: boolean;
  sheetPages: SheetIndexEntry[];
  currentPage: number;
  pageCount: number;
  onNavigate: (page: number) => void;
};

export default function LeftSidebar({ open, sheetPages, currentPage, pageCount, onNavigate }: LeftSidebarProps) {
  const [sheetsExpanded, setSheetsExpanded] = useState(true);
  const [pagesExpanded, setPagesExpanded] = useState(true);
  const hasSheets = sheetPages.some((s) => s.sheetNumber !== null);

  return (
    <aside className={`left-sidebar${open ? ' open' : ''}`} role="complementary" aria-label="Document sidebar">
      <div className="sidebar-header">Document</div>
      <div className="sidebar-content">
        {hasSheets && (
          <div className="sidebar-section">
            <button className="sidebar-section-toggle" onClick={() => setSheetsExpanded(!sheetsExpanded)} aria-expanded={sheetsExpanded}>
              <svg className={`section-chevron${sheetsExpanded ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <polyline points="3,4 5,6 7,4" />
              </svg>
              <span>Sheets</span>
            </button>
            {sheetsExpanded && (
              <SheetIndex pages={sheetPages} currentPage={currentPage} onNavigate={onNavigate} />
            )}
          </div>
        )}
        <div className="sidebar-section">
          <button className="sidebar-section-toggle" onClick={() => setPagesExpanded(!pagesExpanded)} aria-expanded={pagesExpanded}>
            <svg className={`section-chevron${pagesExpanded ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="3,4 5,6 7,4" />
            </svg>
            <span>Pages</span>
          </button>
          {pagesExpanded && (
            <div className="pages-list">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`page-thumb${p === currentPage ? ' active' : ''}`}
                  onClick={() => onNavigate(p)}
                >
                  Page {p}
                </button>
              ))}
              {pageCount === 0 && <div className="pages-empty">No pages</div>}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
