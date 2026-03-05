import type { LeftTab } from '../hooks/usePanelState';
import SheetIndex, { type SheetIndexEntry } from './SheetIndex';

type LeftSidebarProps = {
  open: boolean;
  tab: LeftTab;
  onSetTab: (tab: LeftTab) => void;
  sheetPages: SheetIndexEntry[];
  currentPage: number;
  pageCount: number;
  onNavigate: (page: number) => void;
};

export default function LeftSidebar({ open, tab, onSetTab, sheetPages, currentPage, pageCount, onNavigate }: LeftSidebarProps) {
  return (
    <aside className={`left-sidebar${open ? ' open' : ''}`} role="complementary" aria-label="Document sidebar">
      <div className="sidebar-tabs">
        <button className={`sidebar-tab${tab === 'sheets' ? ' active' : ''}`} onClick={() => onSetTab('sheets')} aria-label="Sheets tab">
          Sheets
        </button>
        <button className={`sidebar-tab${tab === 'pages' ? ' active' : ''}`} onClick={() => onSetTab('pages')} aria-label="Pages tab">
          Pages
        </button>
      </div>
      <div className="sidebar-content">
        {tab === 'sheets' && (
          <SheetIndex pages={sheetPages} currentPage={currentPage} onNavigate={onNavigate} />
        )}
        {tab === 'pages' && (
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
    </aside>
  );
}
