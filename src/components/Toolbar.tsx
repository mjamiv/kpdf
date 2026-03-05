import { useCallback } from 'react';
import type { Tool } from '../types';
import { TOOL_SHORTCUTS } from '../tools/shortcuts';
import { isToolAllowed, type ReviewState } from '../workflow/reviewMode';
import { getToolAriaLabel } from '../utils/accessibility';
import ToolIcon from './ToolIcon';
import NavigationHistory from './NavigationHistory';

type ToolbarProps = {
  // State
  tool: Tool;
  lockedTool: Tool | null;
  color: string;
  author: string;
  flattenOnSave: boolean;
  reviewState: ReviewState;
  panMode: boolean;
  pdfLoaded: boolean;
  isBusy: boolean;
  pageNumber: number;
  pageCount: number;
  pageInput: string;
  zoom: number;
  fitMode: 'manual' | 'width' | 'page';
  // Nav history
  navHistory: number[];
  navCurrentIndex: number;
  // Callbacks
  onOpenFile: () => void;
  onImportSidecar: () => void;
  onExportXfdf: () => void;
  onImportXfdf: () => void;
  onSave: () => void;
  onSetFlatten: (v: boolean) => void;
  onToolClick: (tool: Tool) => void;
  onToolDoubleClick: (tool: Tool) => void;
  onSetColor: (c: string) => void;
  onSetAuthor: (a: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  onTogglePan: () => void;
  onToggleReview: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onCenter: () => void;
  onZoomPreset: (z: number) => void;
  onPageInputChange: (v: string) => void;
  onCommitPageInput: () => void;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  onNavBack: () => void;
  onNavForward: () => void;
  onNavJump: (idx: number) => void;
  // Panel toggles
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleShortcuts: () => void;
  onToggleCommandPalette: () => void;
  onToggleScaleCalibration: () => void;
  onToggleToolPresets: () => void;
  // Panels state
  leftOpen: boolean;
  rightOpen: boolean;
};

const BASIC_TOOLS: Tool[] = ['select', 'pen', 'rectangle', 'highlight', 'text', 'ellipse'];
const SHAPE_TOOLS: Tool[] = ['arrow', 'callout', 'cloud', 'polygon', 'polyline'];
const AEC_TOOLS: Tool[] = ['measurement', 'area', 'angle', 'count', 'dimension'];
const STAMP_TOOLS: Tool[] = ['stamp'];

const toolLabel = (t: Tool) => TOOL_SHORTCUTS.find((s) => s.tool === t)?.label ?? t;
const toolShortcut = (t: Tool) => TOOL_SHORTCUTS.find((s) => s.tool === t)?.key ?? '';

function ToolGroup({ label, tools, currentTool, lockedTool, reviewState, pdfLoaded, onToolClick, onToolDoubleClick, colorClass }: {
  label: string;
  tools: Tool[];
  currentTool: Tool;
  lockedTool: Tool | null;
  reviewState: ReviewState;
  pdfLoaded: boolean;
  onToolClick: (t: Tool) => void;
  onToolDoubleClick: (t: Tool) => void;
  colorClass: string;
}) {
  return (
    <div className={`toolbar-group tool-strip ${colorClass}`} role="group" aria-label={label}>
      {tools.map((id) => (
        <button
          key={id}
          className={`tool-btn${currentTool === id ? ' active' : ''}${lockedTool === id ? ' locked' : ''}`}
          onClick={(e) => { if (e.detail === 1) onToolClick(id); }}
          onDoubleClick={(e) => { e.preventDefault(); onToolDoubleClick(id); }}
          disabled={!pdfLoaded || !isToolAllowed(id, reviewState)}
          title={`${toolLabel(id)}${lockedTool === id ? ' (locked)' : ''} [${toolShortcut(id).toUpperCase()}]`}
          aria-label={getToolAriaLabel(id)}
        >
          <ToolIcon tool={id} />
          <span className="tool-label">{toolLabel(id)}</span>
        </button>
      ))}
    </div>
  );
}

const zoomPresets = [40, 50, 67, 80, 100, 125, 150, 200, 300, 400];

export default function Toolbar(props: ToolbarProps) {
  const {
    tool, lockedTool, color, author, flattenOnSave, reviewState, panMode,
    pdfLoaded, isBusy, pageNumber, pageCount, pageInput, zoom, fitMode,
    navHistory, navCurrentIndex,
    onOpenFile, onImportSidecar, onExportXfdf, onImportXfdf, onSave, onSetFlatten,
    onToolClick, onToolDoubleClick, onSetColor, onSetAuthor,
    onUndo, onRedo, onClearPage, onTogglePan, onToggleReview,
    onZoomIn, onZoomOut, onResetZoom, onFitWidth, onFitPage, onCenter, onZoomPreset,
    onPageInputChange, onCommitPageInput, onFirstPage, onPrevPage, onNextPage, onLastPage,
    onNavBack, onNavForward, onNavJump,
    onToggleLeft, onToggleRight, onToggleShortcuts, onToggleCommandPalette,
    onToggleScaleCalibration, onToggleToolPresets,
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
    <header className={`toolbar${reviewState.active ? ' review-active' : ''}`} role="banner">
      {/* File group */}
      <div className="toolbar-group" role="group" aria-label="File">
        <button onClick={onOpenFile} aria-label="Open PDF file">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h6l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><polyline points="9,2 9,6 13,6"/></svg>
          <span className="tool-label">Open</span>
        </button>
        <button onClick={onImportSidecar} disabled={!pdfLoaded || isBusy} aria-label="Import sidecar JSON">
          <span className="tool-label">Import</span>
        </button>
        <button onClick={onExportXfdf} disabled={!pdfLoaded || isBusy} aria-label="Export XFDF">
          <span className="tool-label">XFDF↑</span>
        </button>
        <button onClick={onImportXfdf} disabled={!pdfLoaded || isBusy} aria-label="Import XFDF">
          <span className="tool-label">XFDF↓</span>
        </button>
        <button onClick={onSave} disabled={!pdfLoaded || isBusy} aria-label="Save PDF">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14H4a1 1 0 01-1-1V3a1 1 0 011-1h6l3 3v9a1 1 0 01-1 1z"/><path d="M10 14v-4H6v4"/><path d="M6 2v3h5"/></svg>
          <span className="tool-label">Save</span>
        </button>
        <label className="toggle-row">
          <input type="checkbox" checked={flattenOnSave} onChange={(e) => onSetFlatten(e.target.checked)} disabled={!pdfLoaded || isBusy} />
          <span className="tool-label">Flatten</span>
        </label>
      </div>

      <div className="divider" />

      {/* Tool groups */}
      <ToolGroup label="Basic tools" tools={BASIC_TOOLS} currentTool={tool} lockedTool={lockedTool}
        reviewState={reviewState} pdfLoaded={pdfLoaded} onToolClick={onToolClick} onToolDoubleClick={onToolDoubleClick} colorClass="tg-basic" />
      <ToolGroup label="Shape tools" tools={SHAPE_TOOLS} currentTool={tool} lockedTool={lockedTool}
        reviewState={reviewState} pdfLoaded={pdfLoaded} onToolClick={onToolClick} onToolDoubleClick={onToolDoubleClick} colorClass="tg-shapes" />
      <ToolGroup label="AEC tools" tools={AEC_TOOLS} currentTool={tool} lockedTool={lockedTool}
        reviewState={reviewState} pdfLoaded={pdfLoaded} onToolClick={onToolClick} onToolDoubleClick={onToolDoubleClick} colorClass="tg-aec" />
      <ToolGroup label="Stamp" tools={STAMP_TOOLS} currentTool={tool} lockedTool={lockedTool}
        reviewState={reviewState} pdfLoaded={pdfLoaded} onToolClick={onToolClick} onToolDoubleClick={onToolDoubleClick} colorClass="tg-stamp" />

      <div className="divider" />

      {/* Options */}
      <div className="toolbar-group" role="group" aria-label="Options">
        <input className="color" type="color" value={color} onChange={(e) => onSetColor(e.target.value)} disabled={!pdfLoaded} title="Markup color" aria-label="Markup color" />
        <label className="author-row">
          <span className="tool-label">Author</span>
          <input className="author-input" value={author} onChange={(e) => onSetAuthor(e.target.value)} disabled={!pdfLoaded} aria-label="Author name" />
        </label>
        <button onClick={onToggleScaleCalibration} disabled={!pdfLoaded} title="Scale calibration" aria-label="Scale calibration">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 14l12-12"/><path d="M2 11v3h3"/><path d="M14 5V2h-3"/></svg>
          <span className="tool-label">Scale</span>
        </button>
        <button onClick={onToggleToolPresets} disabled={!pdfLoaded} title="Tool presets" aria-label="Tool presets">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="4" cy="8" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/></svg>
          <span className="tool-label">Presets</span>
        </button>
      </div>

      <div className="divider" />

      {/* Actions */}
      <div className="toolbar-group" role="group" aria-label="Actions">
        <button onClick={onUndo} disabled={!pdfLoaded} title="Undo (Ctrl+Z)" aria-label="Undo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h6a3 3 0 010 6H7"/><polyline points="7,3 4,6 7,9"/></svg>
          <span className="tool-label">Undo</span>
        </button>
        <button onClick={onRedo} disabled={!pdfLoaded} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6H6a3 3 0 000 6h3"/><polyline points="9,3 12,6 9,9"/></svg>
          <span className="tool-label">Redo</span>
        </button>
        <button onClick={onClearPage} disabled={!pdfLoaded} aria-label="Clear page annotations">
          <span className="tool-label">Clear</span>
        </button>
        <button className={panMode ? 'active' : ''} onClick={onTogglePan} disabled={!pdfLoaded} title="Pan mode (H)" aria-label="Pan mode">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1v14M1 8h14M4 4l4-3 4 3M4 12l4 3 4-3M12 4l3 4-3 4M4 4L1 8l3 4"/></svg>
          <span className="tool-label">Pan</span>
        </button>
        <button className={reviewState.active ? 'active review-toggle' : 'review-toggle'} onClick={onToggleReview} disabled={!pdfLoaded} aria-label="Toggle review mode">
          <span className="tool-label">Review</span>
        </button>
      </div>

      <div className="divider" />

      {/* Zoom */}
      <div className="toolbar-group zoom-group" role="group" aria-label="Zoom controls">
        <button onClick={onZoomOut} disabled={!pdfLoaded} title="Zoom Out" aria-label="Zoom out">−</button>
        <span className="zoom-readout" aria-live="polite">{zoomPercent}%</span>
        <button onClick={onZoomIn} disabled={!pdfLoaded} title="Zoom In" aria-label="Zoom in">+</button>
        <select value={zoomPresets.includes(zoomPercent) ? String(zoomPercent) : ''} onChange={(e) => onZoomPreset(Number(e.target.value) / 100)} disabled={!pdfLoaded} title="Zoom presets" aria-label="Zoom presets">
          <option value="">Preset</option>
          {zoomPresets.map((p) => <option key={p} value={p}>{p}%</option>)}
        </select>
        <button onClick={onResetZoom} disabled={!pdfLoaded} aria-label="Reset zoom to 100%">100%</button>
        <button className={fitMode === 'width' ? 'active' : ''} onClick={onFitWidth} disabled={!pdfLoaded} aria-label="Fit page width">Width</button>
        <button className={fitMode === 'page' ? 'active' : ''} onClick={onFitPage} disabled={!pdfLoaded} aria-label="Fit full page">Page</button>
        <button onClick={onCenter} disabled={!pdfLoaded} aria-label="Center page">Center</button>
      </div>

      <div className="divider" />

      {/* Page nav + history */}
      <div className="toolbar-group page-nav" role="group" aria-label="Page navigation">
        <button onClick={onFirstPage} disabled={!pdfLoaded || pageNumber <= 1} aria-label="First page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="3" x2="3" y2="11"/><polyline points="11,3 6,7 11,11"/></svg>
        </button>
        <button onClick={onPrevPage} disabled={!pdfLoaded || pageNumber <= 1} aria-label="Previous page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="9,3 4,7 9,11"/></svg>
        </button>
        <input className="page-input" value={pageInput} onChange={(e) => onPageInputChange(e.target.value.replace(/[^\d]/g, ''))} onBlur={onCommitPageInput} onKeyDown={handlePageKeyDown} disabled={!pdfLoaded} title="Jump to page" aria-label="Page number" />
        <span className="page-readout">/ {pageCount || 0}</span>
        <button onClick={onNextPage} disabled={!pdfLoaded || pageNumber >= pageCount} aria-label="Next page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="5,3 10,7 5,11"/></svg>
        </button>
        <button onClick={onLastPage} disabled={!pdfLoaded || pageNumber >= pageCount} aria-label="Last page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="11" y1="3" x2="11" y2="11"/><polyline points="3,3 8,7 3,11"/></svg>
        </button>
        <NavigationHistory history={navHistory} currentIndex={navCurrentIndex} onBack={onNavBack} onForward={onNavForward} onJump={onNavJump} maxBreadcrumbs={6} />
      </div>

      <div className="divider" />

      {/* Panel toggles */}
      <div className="toolbar-group" role="group" aria-label="Panels">
        <button className={leftOpen ? 'active' : ''} onClick={onToggleLeft} disabled={!pdfLoaded} title="Toggle left sidebar" aria-label="Toggle sheets sidebar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="14" height="12" rx="1"/><line x1="5" y1="2" x2="5" y2="14"/></svg>
          <span className="tool-label">Sheets</span>
        </button>
        <button className={rightOpen ? 'active' : ''} onClick={onToggleRight} disabled={!pdfLoaded} title="Toggle right panel" aria-label="Toggle right panel">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="14" height="12" rx="1"/><line x1="11" y1="2" x2="11" y2="14"/></svg>
          <span className="tool-label">Panels</span>
        </button>
        <button onClick={onToggleShortcuts} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button>
        <button onClick={onToggleCommandPalette} title="Command palette (Cmd+K)" aria-label="Command palette">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="14" height="9" rx="1"/><line x1="4" y1="7" x2="12" y2="7"/></svg>
          <span className="tool-label">⌘K</span>
        </button>
      </div>
    </header>
  );
}
