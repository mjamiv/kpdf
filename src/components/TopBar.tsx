import { useCallback } from 'react';
import Tooltip from './Tooltip';

type TopBarProps = {
  pdfLoaded: boolean;
  isBusy: boolean;
  zoom: number;
  fitMode: 'manual' | 'width' | 'page';
  pageNumber: number;
  pageCount: number;
  pageInput: string;
  onOpenFile: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onPageInputChange: (v: string) => void;
  onCommitPageInput: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleCommandPalette: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
};

export default function TopBar(props: TopBarProps) {
  const {
    pdfLoaded, isBusy, zoom, fitMode, pageNumber, pageCount, pageInput,
    onOpenFile, onSave, onUndo, onRedo,
    onZoomIn, onZoomOut, onFitWidth, onFitPage,
    onPageInputChange, onCommitPageInput, onPrevPage, onNextPage,
    onToggleCommandPalette, onToggleLeft, onToggleRight,
    leftOpen, rightOpen,
  } = props;

  const zoomPercent = Math.round(zoom * 100);

  const handlePageKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitPageInput();
      (e.target as HTMLInputElement).blur();
    }
  }, [onCommitPageInput]);

  return (
    <header className="top-bar" role="banner">
      {/* Traffic light dots */}
      <div className="traffic-dots" aria-hidden="true">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-green" />
      </div>

      {/* Left: file + edit */}
      <div className="top-bar-group" role="group" aria-label="File">
        <Tooltip content="Toggle sidebar" position="bottom">
          <button className={`top-bar-btn sidebar-toggle${leftOpen ? ' active' : ''}`} onClick={onToggleLeft} disabled={!pdfLoaded} aria-label="Toggle sidebar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="14" height="12" rx="1"/><line x1="5" y1="2" x2="5" y2="14"/></svg>
          </button>
        </Tooltip>
        <Tooltip content="Open PDF" shortcut="Cmd+O" position="bottom">
          <button className="top-bar-btn" onClick={onOpenFile} aria-label="Open PDF file">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h6l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><polyline points="9,2 9,6 13,6"/></svg>
          </button>
        </Tooltip>
        <Tooltip content="Save" shortcut="Cmd+S" position="bottom">
          <button className="top-bar-btn" onClick={onSave} disabled={!pdfLoaded || isBusy} aria-label="Save PDF">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14H4a1 1 0 01-1-1V3a1 1 0 011-1h6l3 3v9a1 1 0 01-1 1z"/><path d="M10 14v-4H6v4"/><path d="M6 2v3h5"/></svg>
          </button>
        </Tooltip>
        <span className="top-bar-sep" />
        <Tooltip content="Undo" shortcut="Cmd+Z" position="bottom">
          <button className="top-bar-btn" onClick={onUndo} disabled={!pdfLoaded} aria-label="Undo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h6a3 3 0 010 6H7"/><polyline points="7,3 4,6 7,9"/></svg>
          </button>
        </Tooltip>
        <Tooltip content="Redo" shortcut="Cmd+Shift+Z" position="bottom">
          <button className="top-bar-btn" onClick={onRedo} disabled={!pdfLoaded} aria-label="Redo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6H6a3 3 0 000 6h3"/><polyline points="9,3 12,6 9,9"/></svg>
          </button>
        </Tooltip>
      </div>

      {/* Center spacer */}
      <div className="top-bar-spacer" />

      {/* Terminal title */}
      <div className="top-bar-title">kpdf@local — 80 × 24</div>

      {/* Center spacer */}
      <div className="top-bar-spacer" />

      {/* Right: zoom + page nav + panels */}
      <div className="top-bar-group" role="group" aria-label="Zoom">
        <Tooltip content="Zoom Out" shortcut="Cmd+-" position="bottom">
          <button className="top-bar-btn" onClick={onZoomOut} disabled={!pdfLoaded} aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="7" x2="11" y2="7"/></svg>
          </button>
        </Tooltip>
        <span className="top-bar-readout">{zoomPercent}%</span>
        <Tooltip content="Zoom In" shortcut="Cmd+=" position="bottom">
          <button className="top-bar-btn" onClick={onZoomIn} disabled={!pdfLoaded} aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/></svg>
          </button>
        </Tooltip>
        <Tooltip content="Fit Width" position="bottom">
          <button className={`top-bar-btn fit-btn${fitMode === 'width' ? ' active' : ''}`} onClick={onFitWidth} disabled={!pdfLoaded} aria-label="Fit width">W</button>
        </Tooltip>
        <Tooltip content="Fit Page" position="bottom">
          <button className={`top-bar-btn fit-btn${fitMode === 'page' ? ' active' : ''}`} onClick={onFitPage} disabled={!pdfLoaded} aria-label="Fit page">P</button>
        </Tooltip>
      </div>

      <span className="top-bar-sep" />

      <div className="top-bar-group" role="group" aria-label="Page navigation">
        <button className="top-bar-btn" onClick={onPrevPage} disabled={!pdfLoaded || pageNumber <= 1} aria-label="Previous page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="9,3 4,7 9,11"/></svg>
        </button>
        <input className="top-bar-page-input" value={pageInput} onChange={(e) => onPageInputChange(e.target.value.replace(/[^\d]/g, ''))} onBlur={onCommitPageInput} onKeyDown={handlePageKeyDown} disabled={!pdfLoaded} aria-label="Page number" />
        <span className="top-bar-page-total">/ {pageCount || 0}</span>
        <button className="top-bar-btn" onClick={onNextPage} disabled={!pdfLoaded || pageNumber >= pageCount} aria-label="Next page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="5,3 10,7 5,11"/></svg>
        </button>
      </div>

      <span className="top-bar-sep" />

      <div className="top-bar-group" role="group" aria-label="Panels">
        <Tooltip content="Toggle panel" position="bottom">
          <button className={`top-bar-btn${rightOpen ? ' active' : ''}`} onClick={onToggleRight} disabled={!pdfLoaded} aria-label="Toggle panel">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="14" height="12" rx="1"/><line x1="11" y1="2" x2="11" y2="14"/></svg>
          </button>
        </Tooltip>
        <Tooltip content="Commands" shortcut="Cmd+K" position="bottom">
          <button className="top-bar-btn" onClick={onToggleCommandPalette} aria-label="Command palette">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="14" height="9" rx="1"/><line x1="4" y1="7" x2="12" y2="7"/></svg>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
