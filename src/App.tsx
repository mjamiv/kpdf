import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './App.css';
import {
  DEFAULT_EMBED_SIZE_THRESHOLD_BYTES,
  extractDocumentFromAttachments,
  createAnnotationDocument,
  downloadSidecar,
  extractDocumentFromKeywords,
  loadAnnotationsFromLocalStorage,
  PDF_ATTACHMENT_FILENAME,
  PDF_ATTACHMENT_MIME,
  parseAnnotationDocument,
  serializeAnnotationDocumentBytes,
  saveAnnotationsToLocalStorage,
  toAnnotationsByPage,
} from './annotationPersistence';
import { exportPdf, type ExportPersistenceResult } from './pdfExport';
import type { Annotation, AnnotationsByPage, AnchorPosition, PageScale, Point, Tool } from './types';
import { annotationReducer, computeInverse, type DocumentState } from './engine/state';
import type { Action } from './engine/actions';
import { createUndoStack, type UndoStack } from './engine/history';
import { clamp01, nextZIndex, randomId, sortedAnnotations } from './engine/utils';
import { createSelectionState, deselectAll, selectAnnotation, type SelectionState } from './engine/selection';
import { getTool } from './tools';
import { getToolForKey } from './tools/shortcuts';
import { drawAnnotations } from './rendering/drawAnnotations';
import { usePanelState } from './hooks/usePanelState';
import { useNavigationHistory } from './hooks/useNavigationHistory';
import { useManagerInit } from './hooks/useManagerInit';
import { useCommandRegistry } from './hooks/useCommandRegistry';
import { announceToScreenReader } from './utils/accessibility';
import { exportToXfdf, importFromXfdf } from './formats/xfdf';
import { addReply, resolveThread, reopenThread, type CommentThread } from './workflow/threading';
import { createPunchList, addPunchItem, updatePunchItem, removePunchItem, type PunchList, type PunchItem } from './workflow/punchList';
import type { PresenceInfo } from './collaboration/syncModel';
import type { SmartLabel, GroupSuggestion } from './ai/aiFeatures';
import type { SheetIndexEntry } from './components/SheetIndex';
import SelectionHandles from './components/SelectionHandles';
import ShortcutHelpPanel from './components/ShortcutHelpPanel';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import TopBar from './components/TopBar';
import ToolRail from './components/ToolRail';
import PanelLayout from './components/PanelLayout';
import LeftSidebar from './components/LeftSidebar';
import RightPanel from './components/RightPanel';
import StampPicker from './components/StampPicker';
import ToolPresets, { type ToolPreset } from './components/ToolPresets';
import ScaleCalibrationPanel from './components/ScaleCalibrationPanel';
import { CommandPalette } from './components/CommandPalette';
import StorageBrowser from './components/StorageBrowser';
import PresenceIndicator from './components/PresenceIndicator';
import ContextMenu from './components/ContextMenu';
import { buildCanvasMenuItems, type ContextMenuItem } from './components/contextMenuItems';
import type { DocumentTab } from './workflow/documentStore';
import { createDocumentTab } from './workflow/documentStore';
import { createReviewState, isToolAllowed, type ReviewState } from './workflow/reviewMode';
import {
  VIEWER_ZOOM_STEP,
  clampPage,
  clampZoom,
  stepZoom,
  zoomForFitPage,
  zoomForFitWidth,
} from './viewer/controls';

type TabData = {
  pdfDoc: PDFDocumentProxy;
  sourceBytes: Uint8Array;
  history: UndoStack;
  author: string;
};

GlobalWorkerOptions.workerSrc = workerUrl;

const BASE_RENDER_SCALE = 1.4;

type FitMode = 'manual' | 'width' | 'page';

function hasCreateAction(action: Action): boolean {
  if (action.type === 'ADD_ANNOTATION') return true;
  if (action.type === 'BATCH') return action.actions.some(hasCreateAction);
  return false;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '') || 'document';
}

const initialState: DocumentState = { annotationsByPage: {} };

export default function App() {
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidecarInputRef = useRef<HTMLInputElement>(null);
  const xfdfInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasShellRef = useRef<HTMLElement>(null);
  const activeRenderRef = useRef<{ cancel: () => void } | null>(null);
  const historyRef = useRef(createUndoStack());
  const draftRef = useRef<unknown>(null);
  const toolRef = useRef<Tool>('select');
  const lockedToolRef = useRef<Tool | null>(null);
  const panDragRef = useRef<{ active: boolean; clientX: number; clientY: number; panX: number; panY: number }>({
    active: false, clientX: 0, clientY: 0, panX: 0, panY: 0,
  });
  const tabDataRef = useRef<Map<string, TabData>>(new Map());
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const handleDragRef = useRef<{
    active: boolean;
    anchor: AnchorPosition;
    annotationId: string;
    startClientX: number;
    startClientY: number;
  }>({ active: false, anchor: 'se', annotationId: '', startClientX: 0, startClientY: 0 });

  // Tab state
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');

  // Tool state
  const [tool, setTool] = useState<Tool>('select');
  const [lockedTool, setLockedTool] = useState<Tool | null>(null);
  const [color, setColor] = useState('#ef4444');
  const [author, setAuthor] = useState('local-user');
  const [flattenOnSave, setFlattenOnSave] = useState(false);
  const [state, dispatchRaw] = useReducer(annotationReducer, initialState);
  const [draft, setDraftState] = useState<unknown>(null);
  const [selection, setSelection] = useState<SelectionState>(createSelectionState);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [status, setStatus] = useState('Drop a PDF or click Open PDF.');
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>(createReviewState);
  const [pageInput, setPageInput] = useState('1');
  const [panMode, setPanMode] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [isPanDragging, setIsPanDragging] = useState(false);

  // Phase 1 state
  const [pageScale, setPageScale] = useState<PageScale | null>(null);
  const [activeStampId, setActiveStampId] = useState('approved');

  // Phase 3 state
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [punchList, setPunchList] = useState<PunchList>(() => createPunchList('Untitled'));
  const [presence] = useState<PresenceInfo>({ users: [] });

  // Phase 2 state
  const [sheetPages, setSheetPages] = useState<SheetIndexEntry[]>([]);

  // Panel & manager state
  const panelState = usePanelState();
  const { panels } = panelState;
  const navHistory = useNavigationHistory();
  const managers = useManagerInit();

  // Derived tab values
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const pdfDoc = activeTab ? tabDataRef.current.get(activeTab.id)?.pdfDoc ?? null : null;
  const sourceBytes = activeTab ? tabDataRef.current.get(activeTab.id)?.sourceBytes ?? null : null;
  const documentFingerprint = activeTab?.fingerprint ?? '';
  const fileName = activeTab?.fileName ?? '';
  const pageNumber = activeTab?.pageNumber ?? 1;
  const pageCount = activeTab?.pageCount ?? 0;
  const zoom = activeTab?.zoom ?? 1;
  const fitMode: FitMode = activeTab?.fitMode ?? 'manual';
  const panX = activeTab?.panX ?? 0;
  const panY = activeTab?.panY ?? 0;
  const { annotationsByPage } = state;

  // Tab update helpers
  const updateActiveTab = useCallback((updater: (tab: DocumentTab) => DocumentTab) => {
    setTabs((prev) => prev.map((t) => t.id === activeTabId ? updater(t) : t));
  }, [activeTabId]);

  const setPageNumber = useCallback((v: number | ((prev: number) => number)) => {
    updateActiveTab((t) => {
      const next = typeof v === 'function' ? v(t.pageNumber) : v;
      return { ...t, pageNumber: clampPage(next, t.pageCount) };
    });
  }, [updateActiveTab]);

  const setZoom = useCallback((v: number | ((prev: number) => number)) => {
    updateActiveTab((t) => {
      const next = typeof v === 'function' ? v(t.zoom) : v;
      return { ...t, zoom: next };
    });
  }, [updateActiveTab]);

  const setPanPosition = useCallback((value: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    updateActiveTab((t) => {
      const prev = { x: t.panX, y: t.panY };
      const next = typeof value === 'function' ? value(prev) : value;
      return { ...t, panX: next.x, panY: next.y };
    });
  }, [updateActiveTab]);

  const setFitMode = useCallback((nextMode: FitMode) => {
    updateActiveTab((t) => ({ ...t, fitMode: nextMode }));
  }, [updateActiveTab]);

  // Sync refs
  useEffect(() => { setPageInput(String(pageNumber || 1)); }, [pageNumber, activeTabId]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { lockedToolRef.current = lockedTool; }, [lockedTool]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  // Track page navigation in history
  useEffect(() => {
    if (pageNumber > 0) navHistory.pushPage(pageNumber);
  }, [pageNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build sheet index when PDF loads
  useEffect(() => {
    if (!pdfDoc) { setSheetPages([]); return; }
    const pages: SheetIndexEntry[] = [];
    for (let i = 0; i < pdfDoc.numPages; i++) {
      pages.push({ pageIndex: i, label: `Page ${i + 1}`, sheetNumber: null });
    }
    setSheetPages(pages);
  }, [pdfDoc]);

  const setDraft = useCallback((value: unknown | ((prev: unknown) => unknown)) => {
    if (typeof value === 'function') {
      setDraftState((prev: unknown) => {
        const next = (value as (p: unknown) => unknown)(prev);
        draftRef.current = next;
        return next;
      });
    } else {
      draftRef.current = value;
      setDraftState(value);
    }
  }, []);

  const setToolSafe = useCallback((newTool: Tool) => {
    if (!isToolAllowed(newTool, reviewState)) return;
    setTool(newTool);
    announceToScreenReader(`Tool: ${newTool}`);
  }, [reviewState]);

  // Zoom helpers
  const applyZoom = useCallback((
    nextZoom: number,
    options?: { anchor?: { clientX: number; clientY: number }; mode?: FitMode },
  ) => {
    if (!pdfDoc) return;
    const clamped = clampZoom(nextZoom);
    const mode = options?.mode ?? 'manual';
    if (mode !== fitMode) setFitMode(mode);
    if (Math.abs(clamped - zoom) < 0.001) return;
    const anchor = options?.anchor;
    if (!anchor || !canvasShellRef.current) { setZoom(clamped); return; }
    const shell = canvasShellRef.current;
    const rect = shell.getBoundingClientRect();
    const localX = anchor.clientX - rect.left;
    const localY = anchor.clientY - rect.top;
    const docX = shell.scrollLeft + localX;
    const docY = shell.scrollTop + localY;
    const scale = clamped / zoom;
    setZoom(clamped);
    requestAnimationFrame(() => { shell.scrollLeft = docX * scale - localX; shell.scrollTop = docY * scale - localY; });
  }, [fitMode, pdfDoc, setFitMode, setZoom, zoom]);

  const zoomIn = useCallback(() => applyZoom(stepZoom(zoom, VIEWER_ZOOM_STEP)), [applyZoom, zoom]);
  const zoomOut = useCallback(() => applyZoom(stepZoom(zoom, -VIEWER_ZOOM_STEP)), [applyZoom, zoom]);
  const resetZoom = useCallback(() => applyZoom(1), [applyZoom]);

  const fitToWidth = useCallback(() => {
    const shell = canvasShellRef.current;
    const overlay = overlayCanvasRef.current;
    if (!shell || !overlay || !pdfDoc || zoom <= 0) return;
    const baseWidth = overlay.width / zoom;
    if (baseWidth <= 0) return;
    setPanPosition({ x: 0, y: 0 });
    applyZoom(zoomForFitWidth(shell.clientWidth, baseWidth), { mode: 'width' });
  }, [applyZoom, pdfDoc, setPanPosition, zoom]);

  const fitToPage = useCallback(() => {
    const shell = canvasShellRef.current;
    const overlay = overlayCanvasRef.current;
    if (!shell || !overlay || !pdfDoc || zoom <= 0) return;
    const baseWidth = overlay.width / zoom;
    const baseHeight = overlay.height / zoom;
    if (baseWidth <= 0 || baseHeight <= 0) return;
    setPanPosition({ x: 0, y: 0 });
    applyZoom(zoomForFitPage(shell.clientWidth, shell.clientHeight, baseWidth, baseHeight), { mode: 'page' });
  }, [applyZoom, pdfDoc, setPanPosition, zoom]);

  const applyCurrentFitMode = useCallback(() => {
    if (fitMode === 'width') { fitToWidth(); return; }
    if (fitMode === 'page') fitToPage();
  }, [fitMode, fitToPage, fitToWidth]);

  // Review mode
  const toggleReviewMode = useCallback(() => {
    setReviewState((prev) => {
      const next = { active: !prev.active };
      if (next.active) {
        setPanMode(false); setTool('select'); setLockedTool(null); setDraft(null); setSelection(deselectAll());
      }
      return next;
    });
  }, [setDraft]);

  // Comment jump
  const handleCommentJump = useCallback((page: number, annotationId: string) => {
    setPageNumber(page);
    setTool('select');
    setDraft(null);
    const pageAnnotations = annotationsByPage[page] ?? [];
    setSelection((prev) => selectAnnotation(prev, annotationId, pageAnnotations));
  }, [setPageNumber, setDraft, annotationsByPage]);

  // Dispatch with undo
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: Action, coalesceKey?: string) => {
    const inverse = computeInverse(stateRef.current, action);
    historyRef.current.push({ forward: action, inverse, timestamp: Date.now(), coalesceKey });
    dispatchRaw(action);
    setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, dirty: true } : t));
    if (hasCreateAction(action)) {
      const currentTool = toolRef.current;
      const isLocked = lockedToolRef.current === currentTool;
      if (currentTool !== 'select' && !isLocked) {
        setTool('select'); setDraft(null); setSelection(deselectAll());
      }
    }
  }, [activeTabId, setDraft]);

  const dispatchSilent = useCallback((action: Action) => { dispatchRaw(action); }, []);

  const currentAnnotations = useMemo(
    () => sortedAnnotations(annotationsByPage[pageNumber] ?? []),
    [annotationsByPage, pageNumber],
  );

  // Render annotations
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    drawAnnotations(overlay, currentAnnotations, draft, tool);
  }, [currentAnnotations, draft, tool]);

  // Autosave to localStorage
  useEffect(() => {
    if (!pdfDoc || !documentFingerprint) return;
    const doc = createAnnotationDocument(annotationsByPage, author, documentFingerprint);
    saveAnnotationsToLocalStorage(documentFingerprint, doc);
    if (activeTabId) {
      setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, annotationsByPage } : t));
    }
  }, [annotationsByPage, author, documentFingerprint, pdfDoc, activeTabId]);

  // Render PDF page
  useEffect(() => {
    if (!pdfDoc) return;
    let isCurrent = true;
    const renderPage = async () => {
      const pdfCanvas = pdfCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!pdfCanvas || !overlayCanvas) return;
      activeRenderRef.current?.cancel();
      setIsBusy(true);
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: BASE_RENDER_SCALE * zoom });
      pdfCanvas.width = Math.round(viewport.width);
      pdfCanvas.height = Math.round(viewport.height);
      overlayCanvas.width = pdfCanvas.width;
      overlayCanvas.height = pdfCanvas.height;
      setCanvasRect(overlayCanvas.getBoundingClientRect());
      const context = pdfCanvas.getContext('2d');
      if (!context) return;
      const renderTask = page.render({ canvasContext: context, viewport, canvas: pdfCanvas });
      activeRenderRef.current = renderTask;
      try { await renderTask.promise; } catch (e) { if ((e as Error).name !== 'RenderingCancelledException') throw e; }
      if (isCurrent) {
        drawAnnotations(overlayCanvas, annotationsByPage[pageNumber] ?? [], draft, tool);
        setIsBusy(false);
        announceToScreenReader(`Page ${pageNumber} of ${pageCount}`);
      }
    };
    renderPage().catch((e) => { setStatus(`Render error: ${(e as Error).message}`); setIsBusy(false); });
    return () => { isCurrent = false; activeRenderRef.current?.cancel(); };
  }, [pdfDoc, pageNumber, zoom, annotationsByPage, draft, tool, pageCount]);

  // Fit mode effects
  useEffect(() => {
    if (!pdfDoc || fitMode === 'manual') return;
    const raf = requestAnimationFrame(() => applyCurrentFitMode());
    return () => cancelAnimationFrame(raf);
  }, [pdfDoc, pageNumber, fitMode, applyCurrentFitMode]);

  useEffect(() => {
    if (!pdfDoc || fitMode === 'manual') return;
    const onResize = () => applyCurrentFitMode();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pdfDoc, fitMode, applyCurrentFitMode]);

  // Pointer helpers
  const toNormalizedPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  };

  const makeToolCtx = useCallback(() => ({
    dispatch, page: pageNumber, color, author: author.trim() || 'local-user',
    annotations: currentAnnotations, selection, draft: draftRef.current,
    setDraft, setSelection, nextZIndex: () => nextZIndex(currentAnnotations), randomId,
  }), [dispatch, pageNumber, color, author, currentAnnotations, selection, setDraft]);

  const startPanDrag = useCallback((clientX: number, clientY: number) => {
    panDragRef.current = { active: true, clientX, clientY, panX: panXRef.current, panY: panYRef.current };
    setIsPanDragging(true);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const panIntent = panMode || spacePanActive || event.button === 1;
    if (panIntent) {
      event.preventDefault();
      startPanDrag(event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerDown(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    if (panDragRef.current.active) {
      const dx = event.clientX - panDragRef.current.clientX;
      const dy = event.clientY - panDragRef.current.clientY;
      setPanPosition({ x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy });
      return;
    }
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerMove(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    if (panDragRef.current.active) {
      panDragRef.current.active = false;
      setIsPanDragging(false);
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
      return;
    }
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerUp(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const handleShellPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!pdfDoc) return;
    if (event.target !== event.currentTarget) return;
    const panIntent = panMode || spacePanActive || event.button === 1;
    if (!panIntent) return;
    event.preventDefault();
    startPanDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleShellPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!panDragRef.current.active) return;
    const dx = event.clientX - panDragRef.current.clientX;
    const dy = event.clientY - panDragRef.current.clientY;
    setPanPosition({ x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy });
  };

  const handleShellPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!panDragRef.current.active) return;
    panDragRef.current.active = false;
    setIsPanDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!pdfDoc) return;
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return;

      // Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        panelState.toggleCommandPalette();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const inv = historyRef.current.undo();
        if (inv) { dispatchSilent(inv); announceToScreenReader('Undo'); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const fwd = historyRef.current.redo();
        if (fwd) { dispatchSilent(fwd); announceToScreenReader('Redo'); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomOut(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); resetZoom(); return; }
      if (e.key === 'PageDown') { e.preventDefault(); setPageNumber((v) => Math.min(pageCount, v + 1)); return; }
      if (e.key === 'PageUp') { e.preventDefault(); setPageNumber((v) => Math.max(1, v - 1)); return; }
      if (e.key === 'Home') { e.preventDefault(); setPageNumber(1); return; }
      if (e.key === 'End') { e.preventDefault(); setPageNumber(pageCount); return; }
      if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); setPanMode((prev) => !prev); return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.ids.size > 0) {
        e.preventDefault();
        for (const id of selection.ids) {
          const ann = currentAnnotations.find((a) => a.id === id);
          if (ann && !ann.locked) dispatch({ type: 'REMOVE_ANNOTATION', page: pageNumber, id, removed: ann });
        }
        setSelection(deselectAll());
        announceToScreenReader(`Deleted ${selection.ids.size} annotation${selection.ids.size > 1 ? 's' : ''}`);
        return;
      }
      if (e.key === '[' && selection.ids.size > 0) { e.preventDefault(); for (const id of selection.ids) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'down' }); return; }
      if (e.key === ']' && selection.ids.size > 0) { e.preventDefault(); for (const id of selection.ids) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'up' }); return; }
      if (e.key === '?') { panelState.toggleShortcuts(); return; }

      const newTool = getToolForKey(e.key);
      if (newTool && isToolAllowed(newTool, reviewState)) {
        setPanMode(false); setLockedTool(null); setTool(newTool); setDraft(null);
        if (newTool !== 'select') setSelection(deselectAll());
        announceToScreenReader(`Tool: ${newTool}`);
      }

      const at = getTool(tool);
      if (at?.onKeyDown) at.onKeyDown(makeToolCtx(), e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pdfDoc, tool, selection, currentAnnotations, pageNumber, dispatch, dispatchSilent, setDraft, makeToolCtx, reviewState, zoomIn, zoomOut, resetZoom, setPageNumber, pageCount, panelState]);

  // Space pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!pdfDoc) return;
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setSpacePanActive(true); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpacePanActive(false); };
    const onBlur = () => { setSpacePanActive(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); };
  }, [pdfDoc]);

  const handleHandleDown = useCallback((anchor: AnchorPosition, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selIds = Array.from(selection.ids);
    if (selIds.length !== 1) return;
    handleDragRef.current = {
      active: true,
      anchor,
      annotationId: selIds[0],
      startClientX: e.clientX,
      startClientY: e.clientY,
    };

    const onMove = (ev: PointerEvent) => {
      if (!handleDragRef.current.active) return;
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (ev.clientX - handleDragRef.current.startClientX) / rect.width;
      const dy = (ev.clientY - handleDragRef.current.startClientY) / rect.height;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        dispatch(
          { type: 'RESIZE_ANNOTATION', page: pageNumber, id: handleDragRef.current.annotationId, anchor: handleDragRef.current.anchor, dx, dy },
          `resize-${handleDragRef.current.annotationId}`,
        );
        handleDragRef.current.startClientX = ev.clientX;
        handleDragRef.current.startClientY = ev.clientY;
      }
    };

    const onUp = () => {
      handleDragRef.current.active = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [selection, dispatch, pageNumber]);

  // Tab management
  const switchToTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    if (activeTabId) {
      const oldData = tabDataRef.current.get(activeTabId);
      if (oldData) oldData.history = historyRef.current;
      setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, annotationsByPage: state.annotationsByPage } : t));
    }
    setActiveTabId(tabId);
    const newTab = tabs.find((t) => t.id === tabId);
    const newData = tabDataRef.current.get(tabId);
    if (newTab && newData) {
      dispatchRaw({ type: 'RESET_STATE', annotationsByPage: newTab.annotationsByPage });
      historyRef.current = newData.history;
      setAuthor(newData.author);
    }
    setDraft(null); setSelection(deselectAll());
  }, [activeTabId, tabs, state.annotationsByPage, setDraft]);

  const closeTab = useCallback((tabId: string) => {
    const tabData = tabDataRef.current.get(tabId);
    tabData?.pdfDoc.destroy();
    tabDataRef.current.delete(tabId);
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId && remaining.length > 0) {
        const newActive = remaining[0];
        setActiveTabId(newActive.id);
        const newData = tabDataRef.current.get(newActive.id);
        if (newData) {
          dispatchRaw({ type: 'RESET_STATE', annotationsByPage: newActive.annotationsByPage });
          historyRef.current = newData.history;
          setAuthor(newData.author);
        }
      } else if (remaining.length === 0) {
        setActiveTabId('');
        dispatchRaw({ type: 'RESET_STATE', annotationsByPage: {} });
        historyRef.current = createUndoStack();
      }
      return remaining;
    });
    setDraft(null); setSelection(deselectAll());
  }, [activeTabId, setDraft]);

  const loadPdf = async (bytes: Uint8Array, name: string) => {
    setIsBusy(true);
    setStatus('Loading PDF...');
    const loadingTask = getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    const metadata = await doc.getMetadata().catch(() => null);
    const attachments = await doc.getAttachments().catch(() => null);
    const fingerprint = doc.fingerprints[0] ?? name;
    const info = metadata?.info as Record<string, unknown> | undefined;
    const keywords = typeof info?.Keywords === 'string' ? info.Keywords : undefined;
    const embeddedAttachment = extractDocumentFromAttachments(attachments);
    const embeddedLegacy = extractDocumentFromKeywords(keywords);
    const embedded = embeddedAttachment ?? embeddedLegacy;
    const local = loadAnnotationsFromLocalStorage(fingerprint);
    let loadedAnnotations: AnnotationsByPage = {};
    let loadedSource = 'empty';
    let loadedAuthor = 'local-user';
    if (embedded) {
      loadedAnnotations = toAnnotationsByPage(embedded);
      loadedAuthor = embedded.exportedBy || 'local-user';
      loadedSource = embeddedAttachment ? 'embedded attachment' : 'legacy embedded metadata';
    } else if (local) {
      loadedAnnotations = toAnnotationsByPage(local);
      loadedAuthor = local.exportedBy || 'local-user';
      loadedSource = 'local autosave';
    }
    if (activeTabId) {
      const oldData = tabDataRef.current.get(activeTabId);
      if (oldData) oldData.history = historyRef.current;
      setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, annotationsByPage: state.annotationsByPage } : t));
    }
    const tabId = randomId();
    const newTab = createDocumentTab(tabId, name, fingerprint, doc.numPages);
    newTab.annotationsByPage = loadedAnnotations;
    const newHistory = createUndoStack();
    tabDataRef.current.set(tabId, { pdfDoc: doc, sourceBytes: bytes, history: newHistory, author: loadedAuthor });
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    setAuthor(loadedAuthor);
    historyRef.current = newHistory;
    dispatchRaw({ type: 'RESET_STATE', annotationsByPage: loadedAnnotations });
    setDraft(null); setSelection(deselectAll());
    setStatus(`Loaded ${name} (${doc.numPages} pages) with ${loadedSource}.`);
    setIsBusy(false);
    announceToScreenReader(`Loaded ${name}, ${doc.numPages} pages`);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await loadPdf(new Uint8Array(await file.arrayBuffer()), file.name); }
    catch (e) { setStatus(`Open error: ${(e as Error).message}`); setIsBusy(false); }
    finally { event.target.value = ''; }
  };

  const handleSidecarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseAnnotationDocument(JSON.parse(await file.text()) as unknown);
      if (!parsed) { setStatus('Invalid sidecar file.'); return; }
      const loaded = toAnnotationsByPage(parsed);
      for (const [pk, anns] of Object.entries(loaded)) dispatchRaw({ type: 'LOAD_PAGE', page: Number(pk), annotations: anns });
      historyRef.current.clear();
      setAuthor(parsed.exportedBy || 'local-user');
      setStatus(parsed.sourceFingerprint && documentFingerprint && parsed.sourceFingerprint !== documentFingerprint
        ? 'Imported sidecar with fingerprint mismatch.'
        : `Imported sidecar (${Object.keys(parsed.pages).length} pages).`);
    } catch (e) { setStatus(`Import error: ${(e as Error).message}`); }
    finally { event.target.value = ''; }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') { setStatus('Drop a valid PDF file.'); return; }
    try { await loadPdf(new Uint8Array(await file.arrayBuffer()), file.name); }
    catch (e) { setStatus(`Drop error: ${(e as Error).message}`); setIsBusy(false); }
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    // Only leave when exiting the app container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const savePdf = async () => {
    if (!sourceBytes) { setStatus('Open a PDF before saving.'); return; }
    try {
      setIsBusy(true);
      setStatus(flattenOnSave ? 'Saving flattened PDF...' : 'Saving editable PDF...');
      const payload = createAnnotationDocument(annotationsByPage, author.trim() || 'local-user', documentFingerprint || undefined);
      const serialized = serializeAnnotationDocumentBytes(payload);
      const safeName = baseName(fileName);
      const output = await exportPdf(sourceBytes, annotationsByPage, {
        flatten: flattenOnSave,
        embeddedAttachment: flattenOnSave ? undefined : {
          fileName: PDF_ATTACHMENT_FILENAME, mimeType: PDF_ATTACHMENT_MIME,
          description: 'KPDF annotation payload v2', content: serialized, thresholdBytes: DEFAULT_EMBED_SIZE_THRESHOLD_BYTES,
        },
      });
      const blob = new Blob([output.bytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = flattenOnSave ? `${safeName}-flattened.pdf` : `${safeName}-editable.pdf`; a.click();
      URL.revokeObjectURL(url);
      downloadSidecar(safeName, payload);
      if (documentFingerprint) saveAnnotationsToLocalStorage(documentFingerprint, payload);
      const msg = (p: ExportPersistenceResult) => {
        if (flattenOnSave) return 'Saved flattened PDF + sidecar JSON.';
        if (p.mode === 'attachment') return 'Saved editable PDF (embedded attachment) + sidecar JSON.';
        if (p.mode === 'sidecar-only') return `Saved PDF + sidecar. Payload ${p.payloadBytes}B > ${p.thresholdBytes}B threshold.`;
        return 'Saved editable PDF + sidecar JSON.';
      };
      setStatus(msg(output.persistence));
      setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, dirty: false } : t));
      setIsBusy(false);
    } catch (e) { setStatus(`Save error: ${(e as Error).message}`); setIsBusy(false); }
  };

  // XFDF export/import
  const handleExportXfdf = useCallback(() => {
    if (!pdfDoc) return;
    const xml = exportToXfdf(annotationsByPage);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${baseName(fileName)}.xfdf`; a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported XFDF.');
  }, [pdfDoc, annotationsByPage, fileName]);

  const handleXfdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const xml = await file.text();
      const loaded = importFromXfdf(xml);
      for (const [pk, anns] of Object.entries(loaded)) {
        dispatchRaw({ type: 'LOAD_PAGE', page: Number(pk), annotations: anns });
      }
      historyRef.current.clear();
      setStatus(`Imported XFDF (${Object.keys(loaded).length} pages).`);
    } catch (e) { setStatus(`XFDF import error: ${(e as Error).message}`); }
    finally { event.target.value = ''; }
  };

  // Actions
  const handleUndo = useCallback(() => { const inv = historyRef.current.undo(); if (inv) { dispatchSilent(inv); announceToScreenReader('Undo'); } }, [dispatchSilent]);
  const handleRedo = useCallback(() => { const fwd = historyRef.current.redo(); if (fwd) { dispatchSilent(fwd); announceToScreenReader('Redo'); } }, [dispatchSilent]);
  const clearPage = useCallback(() => {
    const removed = currentAnnotations.filter((a) => !a.locked);
    if (removed.length > 0) dispatch({ type: 'CLEAR_PAGE', page: pageNumber, removed });
  }, [currentAnnotations, dispatch, pageNumber]);

  const activateTool = useCallback((id: Tool) => {
    setPanMode(false); setToolSafe(id); setDraft(null);
    if (id !== 'select') setSelection(deselectAll());
  }, [setDraft, setToolSafe]);

  const handleToolClick = useCallback((id: Tool) => {
    if (!isToolAllowed(id, reviewState)) return;
    if (lockedTool === id) {
      setLockedTool(null); setStatus(`${id} unlocked.`); return;
    }
    if (lockedTool && lockedTool !== id) setLockedTool(null);
    activateTool(id);
    if (id === 'stamp') panelState.toggleStampPicker();
  }, [activateTool, lockedTool, reviewState, panelState]);

  const handleToolDoubleClick = useCallback((id: Tool) => {
    if (!isToolAllowed(id, reviewState)) return;
    activateTool(id);
    setLockedTool((prev) => {
      const next = prev === id ? null : id;
      setStatus(next ? `${id} locked.` : `${id} unlocked.`);
      return next;
    });
  }, [activateTool, reviewState]);

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (!pdfDoc || !event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? VIEWER_ZOOM_STEP : -VIEWER_ZOOM_STEP;
    applyZoom(stepZoom(zoom, delta), { anchor: { clientX: event.clientX, clientY: event.clientY } });
  }, [applyZoom, pdfDoc, zoom]);

  const commitPageInput = useCallback(() => {
    const parsed = Number.parseInt(pageInput, 10);
    setPageNumber(clampPage(parsed, pageCount));
  }, [pageCount, pageInput, setPageNumber]);

  const togglePanMode = useCallback(() => {
    setPanMode((prev) => !prev);
    setLockedTool(null); setTool('select'); setDraft(null); setSelection(deselectAll());
  }, [setDraft]);

  // Tool presets
  const handleApplyPreset = useCallback((preset: ToolPreset) => {
    setColor(preset.color);
    activateTool(preset.tool);
    setStatus(`Applied preset: ${preset.name}`);
  }, [activateTool]);

  // Scale calibration
  const handleCalibrate = useCallback((scale: PageScale) => {
    setPageScale(scale);
    setStatus(`Scale set: ${scale.realDistance} ${scale.unit}`);
    panelState.closeScaleCalibration();
  }, [panelState]);

  // Threading
  const handleAddReply = useCallback((threadId: string, text: string, parentId?: string) => {
    setThreads((prev) => prev.map((t) => t.id === threadId ? addReply(t, author, text, parentId) : t));
  }, [author]);

  const handleResolveThread = useCallback((threadId: string) => {
    setThreads((prev) => prev.map((t) => t.id === threadId ? resolveThread(t) : t));
  }, []);

  const handleReopenThread = useCallback((threadId: string) => {
    setThreads((prev) => prev.map((t) => t.id === threadId ? reopenThread(t) : t));
  }, []);

  // Punch list
  const handleAddPunchItem = useCallback((item: Partial<PunchItem>) => {
    const fullItem: Omit<PunchItem, 'id' | 'number' | 'createdAt' | 'updatedAt'> = {
      title: item.title ?? '',
      description: item.description ?? '',
      assignee: item.assignee ?? author,
      status: item.status ?? 'open',
      priority: item.priority ?? 'medium',
      category: item.category ?? '',
      page: item.page ?? pageNumber,
      createdBy: item.createdBy ?? author,
    };
    setPunchList((prev) => addPunchItem(prev, fullItem));
  }, [author, pageNumber]);

  const handleUpdatePunchItem = useCallback((id: string, patch: Partial<PunchItem>) => {
    setPunchList((prev) => updatePunchItem(prev, id, patch));
  }, []);

  const handleRemovePunchItem = useCallback((id: string) => {
    setPunchList((prev) => removePunchItem(prev, id));
  }, []);

  // Annotation updates for MarkupsList
  const handleUpdateAnnotation = useCallback((page: number, id: string, patch: Partial<Annotation>) => {
    dispatch({ type: 'UPDATE_ANNOTATION', page, id, patch });
  }, [dispatch]);

  const handleDeleteAnnotations = useCallback((items: Array<{ page: number; id: string }>) => {
    for (const item of items) {
      const anns = annotationsByPage[item.page] ?? [];
      const ann = anns.find((a) => a.id === item.id);
      if (ann) dispatch({ type: 'REMOVE_ANNOTATION', page: item.page, id: item.id, removed: ann });
    }
  }, [annotationsByPage, dispatch]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const selIds = Array.from(selection.ids);
    const annotation = selIds.length === 1 ? currentAnnotations.find((a) => a.id === selIds[0]) ?? null : null;
    const items = buildCanvasMenuItems(annotation, {
      tool,
      onDelete: selIds.length > 0 ? () => {
        const toDelete = selIds.map((id) => ({ page: pageNumber, id }));
        handleDeleteAnnotations(toDelete);
      } : undefined,
      onDeselect: selIds.length > 0 ? () => setSelection(deselectAll()) : undefined,
    });
    if (items.length > 0) setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [selection, currentAnnotations, tool, pageNumber, handleDeleteAnnotations]);

  // AI callbacks
  const handleApplyLabels = useCallback((labels: SmartLabel[]) => {
    for (const label of labels) {
      for (const [pk, anns] of Object.entries(annotationsByPage)) {
        const ann = anns.find((a) => a.id === label.annotationId);
        if (ann) dispatch({ type: 'UPDATE_ANNOTATION', page: Number(pk), id: label.annotationId, patch: { comment: label.suggestedLabel } });
      }
    }
    setStatus(`Applied ${labels.length} AI labels.`);
  }, [annotationsByPage, dispatch]);

  const handleGroupAnnotations = useCallback((_group: GroupSuggestion) => {
    setStatus('Group suggestion noted.');
  }, []);

  // Navigation callbacks
  const handleNavBack = useCallback(() => {
    navHistory.goBack();
    const page = navHistory.history[navHistory.currentIndex - 1];
    if (page) setPageNumber(page);
  }, [navHistory, setPageNumber]);

  const handleNavForward = useCallback(() => {
    navHistory.goForward();
    const page = navHistory.history[navHistory.currentIndex + 1];
    if (page) setPageNumber(page);
  }, [navHistory, setPageNumber]);

  const handleNavJump = useCallback((idx: number) => {
    navHistory.jumpTo(idx);
    const page = navHistory.history[idx];
    if (page) setPageNumber(page);
  }, [navHistory, setPageNumber]);

  // Page nav callbacks for toolbar
  const handlePageNav = useCallback((page: number) => {
    setDraft(null);
    setPageNumber(page);
  }, [setDraft, setPageNumber]);

  // Command registry
  const commands = useCommandRegistry({
    setTool: activateTool,
    undo: handleUndo,
    redo: handleRedo,
    canUndo: true,
    canRedo: true,
    zoom,
    setZoom: (z) => applyZoom(z),
    currentPage: pageNumber,
    pageCount,
    setCurrentPage: (p) => handlePageNav(p),
    togglePanels: {
      shortcuts: panelState.toggleShortcuts,
      comments: () => panelState.setRightTab('activity'),
      markups: () => panelState.setRightTab('markups'),
      punchList: () => panelState.setRightTab('activity'),
      ai: () => panelState.setRightTab('ai'),
      sheets: panelState.toggleLeft,
    },
    exportPdf: pdfDoc ? savePdf : undefined,
    exportAnnotations: pdfDoc ? handleExportXfdf : undefined,
    clearPage: pdfDoc ? clearPage : undefined,
    toggleReview: toggleReviewMode,
    toggleFlatten: () => setFlattenOnSave((v) => !v),
    importSidecar: () => sidecarInputRef.current?.click(),
    importXfdf: () => xfdfInputRef.current?.click(),
    exportXfdf: pdfDoc ? handleExportXfdf : undefined,
    toggleScaleCalibration: panelState.toggleScaleCalibration,
    toggleToolPresets: panelState.toggleToolPresets,
  });

  // Keep nav history handlers referenced to suppress unused warnings
  void handleNavBack; void handleNavForward; void handleNavJump;

  const overlayCursor = isPanDragging ? 'grabbing' : (panMode || spacePanActive ? 'grab' : (getTool(tool)?.cursor ?? 'crosshair'));

  return (
    <div className={`app${isDragOver ? ' drag-over' : ''}`} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} hidden />
      <input ref={sidecarInputRef} type="file" accept="application/json,.json,.kpdf.json" onChange={handleSidecarFileChange} hidden />
      <input ref={xfdfInputRef} type="file" accept=".xfdf,application/xml,text/xml" onChange={handleXfdfFileChange} hidden />

      {/* Skip nav */}
      <a href="#main-canvas" className="skip-nav">Skip to content</a>

      {/* Loading bar */}
      {isBusy && <div className="busy-bar" />}

      {/* Top bar */}
      <TopBar
        pdfLoaded={!!pdfDoc} isBusy={isBusy}
        zoom={zoom} fitMode={fitMode}
        pageNumber={pageNumber} pageCount={pageCount} pageInput={pageInput}
        onOpenFile={() => fileInputRef.current?.click()}
        onSave={savePdf}
        onUndo={handleUndo} onRedo={handleRedo}
        onZoomIn={zoomIn} onZoomOut={zoomOut}
        onFitWidth={fitToWidth} onFitPage={fitToPage}
        onPageInputChange={setPageInput} onCommitPageInput={commitPageInput}
        onPrevPage={() => handlePageNav(Math.max(1, pageNumber - 1))}
        onNextPage={() => handlePageNav(Math.min(pageCount, pageNumber + 1))}
        onToggleCommandPalette={panelState.toggleCommandPalette}
        onToggleLeft={panelState.toggleLeft} onToggleRight={panelState.toggleRight}
        leftOpen={panels.leftOpen} rightOpen={panels.rightOpen}
      />

      {/* Tab bar */}
      <TabBar tabs={tabs} activeTabId={activeTabId} onSelectTab={switchToTab} onCloseTab={closeTab} />

      {/* Presence */}
      {presence.users.length > 0 && (
        <PresenceIndicator presence={presence} currentUserId={author} />
      )}

      {/* 4-column layout: rail + sidebar + canvas + panel */}
      <PanelLayout
        toolRail={
          <ToolRail
            tool={tool} lockedTool={lockedTool}
            reviewState={reviewState} pdfLoaded={!!pdfDoc}
            panMode={panMode} color={color}
            onToolClick={handleToolClick} onToolDoubleClick={handleToolDoubleClick}
            onTogglePan={togglePanMode} onSetColor={setColor}
            onToggleShortcuts={panelState.toggleShortcuts}
          />
        }
        leftSidebar={
          <LeftSidebar
            open={panels.leftOpen}
            sheetPages={sheetPages}
            currentPage={pageNumber}
            pageCount={pageCount}
            onNavigate={handlePageNav}
          />
        }
        rightPanel={
          <RightPanel
            open={panels.rightOpen}
            tab={panels.rightTab}
            onSetTab={panelState.setRightTab}
            onClose={panelState.toggleRight}
            annotationsByPage={annotationsByPage}
            onCommentJump={handleCommentJump}
            threads={threads}
            currentAuthor={author}
            onAddReply={handleAddReply}
            onResolveThread={handleResolveThread}
            onReopenThread={handleReopenThread}
            onUpdateAnnotation={handleUpdateAnnotation}
            onDeleteAnnotations={handleDeleteAnnotations}
            punchList={punchList}
            currentUser={author}
            onAddPunchItem={handleAddPunchItem}
            onUpdatePunchItem={handleUpdatePunchItem}
            onRemovePunchItem={handleRemovePunchItem}
            annotations={currentAnnotations}
            aiManager={managers.aiManager}
            onApplyLabels={handleApplyLabels}
            onGroupAnnotations={handleGroupAnnotations}
          />
        }
      >
        <main
          id="main-canvas"
          ref={canvasShellRef}
          className={`canvas-shell${(panMode || spacePanActive || isPanDragging) ? ' pan-ready' : ''}${isPanDragging ? ' panning' : ''}`}
          onWheel={handleCanvasWheel}
          onPointerDown={handleShellPointerDown}
          onPointerMove={handleShellPointerMove}
          onPointerUp={handleShellPointerUp}
          onPointerLeave={handleShellPointerUp}
          onContextMenu={handleCanvasContextMenu}
          role="main"
        >
          {!pdfDoc ? (
            <div className={`empty-state${isDragOver ? ' drag-active' : ''}`}>
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="4" width="32" height="40" rx="3" />
                  <polyline points="24,4 24,16 36,16" />
                  <line x1="16" y1="24" x2="32" y2="24" />
                  <line x1="16" y1="30" x2="28" y2="30" />
                  <line x1="16" y1="36" x2="24" y2="36" />
                </svg>
              </div>
              <h1>KPDF Markup</h1>
              <p>Drop a PDF here or click <strong>Open</strong> to begin.</p>
              <div className="empty-state-shortcuts">
                <kbd>Cmd+O</kbd> Open &nbsp; <kbd>Cmd+K</kbd> Commands
              </div>
            </div>
          ) : (
            <div className="page-wrap" style={{ transform: `translate(${panX}px, ${panY}px)` }}>
              <canvas ref={pdfCanvasRef} className="pdf-canvas" />
              <canvas ref={overlayCanvasRef} className="overlay-canvas" style={{ cursor: overlayCursor }}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
              <SelectionHandles selection={selection} annotations={currentAnnotations}
                canvasWidth={overlayCanvasRef.current?.width ?? 0} canvasHeight={overlayCanvasRef.current?.height ?? 0}
                canvasRect={canvasRect} onHandleDown={handleHandleDown} />
            </div>
          )}
        </main>
      </PanelLayout>

      {/* Status bar */}
      <StatusBar status={status} tool={tool} lockedTool={lockedTool} />

      {/* Modal overlays */}
      <ShortcutHelpPanel visible={panels.showShortcuts} onClose={panelState.closeShortcuts} />
      <CommandPalette commands={commands} isOpen={panels.commandPaletteOpen} onClose={panelState.closeCommandPalette} onExecute={() => {}} />
      <ScaleCalibrationPanel visible={panels.showScaleCalibration} currentScale={pageScale} onCalibrate={handleCalibrate} onClear={() => setPageScale(null)} onClose={panelState.closeScaleCalibration} />
      {panels.storageBrowserOpen && (
        <StorageBrowser storageManager={managers.storageManager} onFileSelect={(file, data) => { loadPdf(data, file.name); panelState.closeStorageBrowser(); }} onClose={panelState.closeStorageBrowser} />
      )}

      {/* Popovers */}
      <StampPicker visible={panels.showStampPicker} activeStampId={activeStampId} onSelectStamp={(s) => { setActiveStampId(s.id); activateTool('stamp'); }} onClose={panelState.closeStampPicker} />
      <ToolPresets visible={panels.showToolPresets} currentColor={color} currentTool={tool} onApplyPreset={handleApplyPreset} onClose={panelState.closeToolPresets} />

      {/* Context menu */}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M20 8v24M8 20h24" />
            </svg>
            <span>Drop PDF to open</span>
          </div>
        </div>
      )}
    </div>
  );
}
