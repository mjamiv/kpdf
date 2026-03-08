import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
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
import { exportPdf } from './pdfExport';
import type { Annotation, AnnotationsByPage, AnchorPosition, PageScale, Point, Tool } from './types';
import { annotationReducer, computeInverse, type DocumentState } from './engine/state';
import type { Action } from './engine/actions';
import { createUndoStack, type UndoStack } from './engine/history';
import { clamp01, nextZIndex, randomId, sortedAnnotations } from './engine/utils';
import { createSelectionState, deselectAll, selectAll, selectAnnotation, type SelectionState } from './engine/selection';
import { moveAnnotation } from './engine/transforms';
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

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;
async function getPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsReady;
}

type TabData = {
  pdfDoc: PDFDocumentProxy;
  sourceBytes: Uint8Array;
  history: UndoStack;
  author: string;
};

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
  const renderedZoomRef = useRef(1);
  const zoomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelZoomingRef = useRef(false);
  const wheelZoomEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panVelocityRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const momentumRafRef = useRef<number | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ initialDistance: number; initialZoom: number; midX: number; midY: number } | null>(null);
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
  const [zoomWindowMode, setZoomWindowMode] = useState(false);
  const zoomWindowRef = useRef<{ startX: number; startY: number; curX: number; curY: number; active: boolean } | null>(null);
  const [zoomWindowRect, setZoomWindowRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Phase 1 state
  const [pageScale, setPageScale] = useState<PageScale | null>(null);
  const [activeStampId, setActiveStampId] = useState('approved');
  const [scrollZoomMode, setScrollZoomMode] = useState<boolean>(() => localStorage.getItem('kpdf-scroll-zoom') === 'true');
  const clipboardRef = useRef<Annotation[]>([]);

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

  // Persist scroll-zoom preference
  useEffect(() => {
    localStorage.setItem('kpdf-scroll-zoom', scrollZoomMode ? 'true' : 'false');
  }, [scrollZoomMode]);

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

  const debouncedRenderZoom = useCallback((nextZoom: number, anchor?: { clientX: number; clientY: number }) => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(() => {
      applyZoom(nextZoom, anchor ? { anchor } : undefined);
      zoomDebounceRef.current = null;
    }, 80);
  }, [applyZoom]);

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
    if (fitMode === 'width') fitToWidth();
    else if (fitMode === 'page') fitToPage();
  }, [fitMode, fitToWidth, fitToPage]);

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

  const annotationMap = useMemo(
    () => new Map(currentAnnotations.map((a) => [a.id, a])),
    [currentAnnotations],
  );

  // Render annotations (RAF-throttled)
  const overlayRafRef = useRef<number | null>(null);
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current);
    overlayRafRef.current = requestAnimationFrame(() => {
      drawAnnotations(overlay, currentAnnotations, draft, tool, selection.ids);
      overlayRafRef.current = null;
    });
    return () => { if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current); };
  }, [currentAnnotations, draft, tool, selection.ids]);

  // Autosave to localStorage (debounced)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pdfDoc || !documentFingerprint) return;
    if (activeTabId) {
      setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, annotationsByPage } : t));
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const doc = createAnnotationDocument(annotationsByPage, author, documentFingerprint);
      saveAnnotationsToLocalStorage(documentFingerprint, doc);
    }, 1500);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
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
        renderedZoomRef.current = zoom;
        drawAnnotations(overlayCanvas, annotationsByPage[pageNumber] ?? [], draft, tool, selection.ids);
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
  const toNormalizedPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  }, []);

  const makeToolCtx = useCallback(() => ({
    dispatch, page: pageNumber, color, author: author.trim() || 'local-user',
    annotations: currentAnnotations, selection, draft: draftRef.current,
    setDraft, setSelection, nextZIndex: () => nextZIndex(currentAnnotations), randomId,
  }), [dispatch, pageNumber, color, author, currentAnnotations, selection, setDraft]);

  const startPanDrag = useCallback((clientX: number, clientY: number) => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    panVelocityRef.current = [];
    panDragRef.current = { active: true, clientX, clientY, panX: panXRef.current, panY: panYRef.current };
    setIsPanDragging(true);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    // Two pointers → begin pinch-to-zoom
    if (activePointersRef.current.size === 2) {
      event.preventDefault();
      panDragRef.current.active = false;
      setIsPanDragging(false);
      setDraft(null);
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      pinchStateRef.current = {
        initialDistance: Math.sqrt(dx * dx + dy * dy) || 1,
        initialZoom: zoom,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      return;
    }

    const panIntent = panMode || spacePanActive || event.button === 1;
    if (panIntent) {
      event.preventDefault();
      startPanDrag(event.clientX, event.clientY);
      return;
    }

    if (zoomWindowMode) {
      event.preventDefault();
      zoomWindowRef.current = { startX: event.clientX, startY: event.clientY, curX: event.clientX, curY: event.clientY, active: true };
      setZoomWindowRect(null);
      return;
    }

    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerDown(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const updatePanFromPointer = useCallback((clientX: number, clientY: number) => {
    const { clientX: startX, clientY: startY, panX, panY } = panDragRef.current;
    setPanPosition({ x: panX + clientX - startX, y: panY + clientY - startY });
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;

    // Multi-pointer (pinch) handling
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointersRef.current.size === 2 && pinchStateRef.current) {
        const pts = Array.from(activePointersRef.current.values());
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const ratio = dist / pinchStateRef.current.initialDistance;
        const nextZoom = clampZoom(pinchStateRef.current.initialZoom * ratio);
        setZoom(nextZoom);
        setFitMode('manual');
        const panDx = midX - pinchStateRef.current.midX;
        const panDy = midY - pinchStateRef.current.midY;
        setPanPosition((prev) => ({ x: prev.x + panDx, y: prev.y + panDy }));
        pinchStateRef.current.midX = midX;
        pinchStateRef.current.midY = midY;
        debouncedRenderZoom(nextZoom, { clientX: midX, clientY: midY });
        return;
      }
    }

    if (panDragRef.current.active) {
      const samples = panVelocityRef.current;
      samples.push({ x: event.clientX, y: event.clientY, time: Date.now() });
      if (samples.length > 5) samples.splice(0, samples.length - 5);
      updatePanFromPointer(event.clientX, event.clientY);
      return;
    }

    if (zoomWindowRef.current?.active) {
      zoomWindowRef.current.curX = event.clientX;
      zoomWindowRef.current.curY = event.clientY;
      const shell = canvasShellRef.current;
      if (shell) {
        const sr = shell.getBoundingClientRect();
        const sx = zoomWindowRef.current.startX - sr.left;
        const sy = zoomWindowRef.current.startY - sr.top;
        const cx = event.clientX - sr.left;
        const cy = event.clientY - sr.top;
        setZoomWindowRect({
          x: Math.min(sx, cx), y: Math.min(sy, cy),
          w: Math.abs(cx - sx), h: Math.abs(cy - sy),
        });
      }
      return;
    }

    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerMove(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;

    activePointersRef.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }

    if (pinchStateRef.current) {
      if (activePointersRef.current.size < 2) {
        pinchStateRef.current = null;
      }
      return;
    }

    if (panDragRef.current.active) {
      panDragRef.current.active = false;
      setIsPanDragging(false);

      // Compute momentum velocity from recent samples
      const samples = panVelocityRef.current;
      if (samples.length >= 2) {
        const last = samples[samples.length - 1];
        const first = samples[0];
        const dt = last.time - first.time;
        if (dt > 0 && dt < 300) {
          let vx = (last.x - first.x) / dt * 16;
          let vy = (last.y - first.y) / dt * 16;
          const mag = Math.sqrt(vx * vx + vy * vy);
          if (mag > 0.5) {
            const friction = 0.92;
            const tick = () => {
              vx *= friction;
              vy *= friction;
              if (Math.sqrt(vx * vx + vy * vy) < 0.5) {
                momentumRafRef.current = null;
                return;
              }
              setPanPosition((prev) => ({ x: prev.x + vx, y: prev.y + vy }));
              momentumRafRef.current = requestAnimationFrame(tick);
            };
            momentumRafRef.current = requestAnimationFrame(tick);
          }
        }
      }
      panVelocityRef.current = [];
      return;
    }

    if (zoomWindowRef.current?.active) {
      const zw = zoomWindowRef.current;
      zoomWindowRef.current = null;
      setZoomWindowRect(null);

      const shell = canvasShellRef.current;
      if (shell) {
        const sr = shell.getBoundingClientRect();
        const x1 = zw.startX - sr.left;
        const y1 = zw.startY - sr.top;
        const x2 = event.clientX - sr.left;
        const y2 = event.clientY - sr.top;
        const bw = Math.abs(x2 - x1);
        const bh = Math.abs(y2 - y1);
        if (bw > 10 && bh > 10) {
          const boxCx = Math.min(x1, x2) + bw / 2;
          const boxCy = Math.min(y1, y2) + bh / 2;
          const scaleX = sr.width / bw;
          const scaleY = sr.height / bh;
          const newZoomFactor = Math.min(scaleX, scaleY) * 0.9;
          const nextZoom = clampZoom(zoom * newZoomFactor);

          setZoom(nextZoom);
          setFitMode('manual');

          const wrap = shell.querySelector('.page-wrap') as HTMLElement | null;
          if (wrap) wrap.style.transition = 'none';

          requestAnimationFrame(() => {
            const ratio = nextZoom / zoom;
            const docCx = shell.scrollLeft + boxCx;
            const docCy = shell.scrollTop + boxCy;
            shell.scrollLeft = docCx * ratio - sr.width / 2;
            shell.scrollTop = docCy * ratio - sr.height / 2;

            if (wrap) requestAnimationFrame(() => { wrap.style.transition = ''; });
          });

          debouncedRenderZoom(nextZoom);
        }
      }

      setZoomWindowMode(false);
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
    const samples = panVelocityRef.current;
    samples.push({ x: event.clientX, y: event.clientY, time: Date.now() });
    if (samples.length > 5) samples.splice(0, samples.length - 5);
    updatePanFromPointer(event.clientX, event.clientY);
  };

  const handleShellPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!panDragRef.current.active) return;
    panDragRef.current.active = false;
    setIsPanDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }

    const samples = panVelocityRef.current;
    if (samples.length >= 2) {
      const last = samples[samples.length - 1];
      const first = samples[0];
      const dt = last.time - first.time;
      if (dt > 0 && dt < 300) {
        let vx = (last.x - first.x) / dt * 16;
        let vy = (last.y - first.y) / dt * 16;
        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag > 0.5) {
          const friction = 0.92;
          const tick = () => {
            vx *= friction;
            vy *= friction;
            if (Math.sqrt(vx * vx + vy * vy) < 0.5) {
              momentumRafRef.current = null;
              return;
            }
            setPanPosition((prev) => ({ x: prev.x + vx, y: prev.y + vy }));
            momentumRafRef.current = requestAnimationFrame(tick);
          };
          momentumRafRef.current = requestAnimationFrame(tick);
        }
      }
    }
    panVelocityRef.current = [];
  };

  const toggleZoomWindow = useCallback(() => {
    setZoomWindowMode((prev) => !prev);
    setPanMode(false);
    setLockedTool(null); setTool('select'); setDraft(null); setSelection(deselectAll());
  }, [setDraft]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return;

      // Cmd+O — open file (works even without PDF loaded)
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }

      // Cmd+K — command palette (works even without PDF loaded)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        panelState.toggleCommandPalette();
        return;
      }

      if (!pdfDoc) return;

      // Cmd+S — save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        savePdf();
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
          const ann = annotationMap.get(id);
          if (ann && !ann.locked) dispatch({ type: 'REMOVE_ANNOTATION', page: pageNumber, id, removed: ann });
        }
        setSelection(deselectAll());
        announceToScreenReader(`Deleted ${selection.ids.size} annotation${selection.ids.size > 1 ? 's' : ''}`);
        return;
      }
      if (e.key === '[' && selection.ids.size > 0) { e.preventDefault(); for (const id of selection.ids) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'down' }); return; }
      if (e.key === ']' && selection.ids.size > 0) { e.preventDefault(); for (const id of selection.ids) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'up' }); return; }
      if (e.key === '?') { panelState.toggleShortcuts(); return; }

      // Escape: zoom-window off → tool → select, selection → deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        if (zoomWindowMode) {
          setZoomWindowMode(false);
          zoomWindowRef.current = null;
          setZoomWindowRect(null);
          return;
        }
        if (tool !== 'select') {
          setTool('select'); setLockedTool(null); setDraft(null); setPanMode(false);
          announceToScreenReader('Tool: select');
        } else if (selection.ids.size > 0) {
          setSelection(deselectAll());
          announceToScreenReader('Deselected');
        }
        return;
      }

      // Arrow-key nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selection.ids.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.001;
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        for (const id of selection.ids) {
          dispatch({ type: 'MOVE_ANNOTATION', page: pageNumber, id, dx, dy }, `nudge-${id}`);
        }
        return;
      }

      // Cmd+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setTool('select'); setDraft(null);
        setSelection(selectAll(currentAnnotations));
        announceToScreenReader(`Selected ${currentAnnotations.filter(a => !a.locked).length} annotations`);
        return;
      }

      // Cmd+C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection.ids.size > 0) {
        e.preventDefault();
        clipboardRef.current = currentAnnotations.filter(a => selection.ids.has(a.id));
        announceToScreenReader(`Copied ${clipboardRef.current.length} annotation${clipboardRef.current.length > 1 ? 's' : ''}`);
        return;
      }

      // Cmd+V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardRef.current.length > 0) {
        e.preventDefault();
        const offset = 0.02;
        const newIds: string[] = [];
        for (const ann of clipboardRef.current) {
          const id = randomId();
          newIds.push(id);
          const moved = moveAnnotation(ann, offset, offset);
          dispatch({ type: 'ADD_ANNOTATION', page: pageNumber, annotation: { ...moved, id, zIndex: nextZIndex(currentAnnotations) } });
        }
        return;
      }

      // Cmd+D: Duplicate in-place
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selection.ids.size > 0) {
        e.preventDefault();
        const selected = currentAnnotations.filter(a => selection.ids.has(a.id));
        for (const ann of selected) {
          const id = randomId();
          const moved = moveAnnotation(ann, 0.015, 0.015);
          dispatch({ type: 'ADD_ANNOTATION', page: pageNumber, annotation: { ...moved, id, zIndex: nextZIndex(currentAnnotations) } });
        }
        return;
      }

      if (e.key === 'w' && !e.ctrlKey && !e.metaKey) {
        toggleZoomWindow();
        return;
      }

      const newTool = getToolForKey(e.key);
      if (newTool && isToolAllowed(newTool, reviewState)) {
        setPanMode(false); setZoomWindowMode(false); setLockedTool(null); setTool(newTool); setDraft(null);
        if (newTool !== 'select') setSelection(deselectAll());
        announceToScreenReader(`Tool: ${newTool}`);
      }

      const at = getTool(tool);
      if (at?.onKeyDown) at.onKeyDown(makeToolCtx(), e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pdfDoc, tool, selection, currentAnnotations, pageNumber, dispatch, dispatchSilent, setDraft, makeToolCtx, reviewState, zoomIn, zoomOut, resetZoom, setPageNumber, pageCount, panelState, toggleZoomWindow, zoomWindowMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      let dx = (ev.clientX - handleDragRef.current.startClientX) / rect.width;
      let dy = (ev.clientY - handleDragRef.current.startClientY) / rect.height;
      if (ev.shiftKey) {
        const max = Math.max(Math.abs(dx), Math.abs(dy));
        dx = max * Math.sign(dx || 1);
        dy = max * Math.sign(dy || 1);
      }
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
    const pdfjs = await getPdfjs();
    const loadingTask = pdfjs.getDocument({ data: bytes });
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
      const p = output.persistence;
      let saveMsg: string;
      if (flattenOnSave) saveMsg = 'Saved flattened PDF + sidecar JSON.';
      else if (p.mode === 'attachment') saveMsg = 'Saved editable PDF (embedded attachment) + sidecar JSON.';
      else if (p.mode === 'sidecar-only') saveMsg = `Saved PDF + sidecar. Payload ${p.payloadBytes}B > ${p.thresholdBytes}B threshold.`;
      else saveMsg = 'Saved editable PDF + sidecar JSON.';
      setStatus(saveMsg);
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
    if (!pdfDoc) return;
    const wantsZoom = event.ctrlKey || event.metaKey || scrollZoomMode;
    if (!wantsZoom) return;
    event.preventDefault();

    // Trackpad pinch gestures report ctrlKey with small fractional deltaY;
    // mouse wheels report larger integer deltaY. Normalize to a continuous
    // zoom factor using an exponential curve for smoothness.
    const delta = -event.deltaY;
    const sensitivity = event.deltaMode === 1 ? 0.12 : 0.018;
    const factor = Math.exp(delta * sensitivity);
    const nextZoom = clampZoom(zoom * factor);
    if (nextZoom === zoom) return;

    // Mark zoom active — disables CSS transition for instant visual feedback
    if (!wheelZoomingRef.current) {
      wheelZoomingRef.current = true;
      const wrap = canvasShellRef.current?.querySelector('.page-wrap') as HTMLElement | null;
      if (wrap) wrap.style.transition = 'none';
    }
    if (wheelZoomEndTimer.current) clearTimeout(wheelZoomEndTimer.current);
    wheelZoomEndTimer.current = setTimeout(() => {
      wheelZoomingRef.current = false;
      const wrap = canvasShellRef.current?.querySelector('.page-wrap') as HTMLElement | null;
      if (wrap) wrap.style.transition = '';
    }, 150);

    setZoom(nextZoom);
    setFitMode('manual');
    debouncedRenderZoom(nextZoom, { clientX: event.clientX, clientY: event.clientY });
  }, [pdfDoc, scrollZoomMode, zoom, setZoom, setFitMode, debouncedRenderZoom]);

  const commitPageInput = useCallback(() => {
    const parsed = Number.parseInt(pageInput, 10);
    setPageNumber(clampPage(parsed, pageCount));
  }, [pageCount, pageInput, setPageNumber]);

  const togglePanMode = useCallback(() => {
    setPanMode((prev) => !prev);
    setZoomWindowMode(false);
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
      onSelectAll: () => { setTool('select'); setDraft(null); setSelection(selectAll(currentAnnotations)); },
      onCopy: selIds.length > 0 ? () => {
        clipboardRef.current = currentAnnotations.filter(a => selection.ids.has(a.id));
        setStatus(`Copied ${clipboardRef.current.length} annotation(s).`);
      } : undefined,
      onPaste: clipboardRef.current.length > 0 ? () => {
        for (const ann of clipboardRef.current) {
          const id = randomId();
          const moved = moveAnnotation(ann, 0.02, 0.02);
          dispatch({ type: 'ADD_ANNOTATION', page: pageNumber, annotation: { ...moved, id, zIndex: nextZIndex(currentAnnotations) } });
        }
      } : undefined,
      onBringToFront: selIds.length > 0 ? () => {
        for (const id of selIds) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'up' });
      } : undefined,
      onSendToBack: selIds.length > 0 ? () => {
        for (const id of selIds) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'down' });
      } : undefined,
      onSwitchTool: (t: Tool) => { activateTool(t); },
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

  // Page nav callbacks for toolbar
  const handlePageNav = useCallback((page: number) => {
    setDraft(null);
    setPageNumber(page);
  }, [setDraft, setPageNumber]);

  // Command registry
  const commands = useCommandRegistry({
    setTool: activateTool,
    setLockedTool: (t) => { if (t) { activateTool(t); setLockedTool(t); setStatus(`${t} locked.`); } else { setLockedTool(null); } },
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
    toggleScrollZoom: () => setScrollZoomMode((v) => !v),
    importSidecar: () => sidecarInputRef.current?.click(),
    importXfdf: () => xfdfInputRef.current?.click(),
    exportXfdf: pdfDoc ? handleExportXfdf : undefined,
    toggleScaleCalibration: panelState.toggleScaleCalibration,
    toggleToolPresets: panelState.toggleToolPresets,
    toggleZoomWindow,
  });

  const overlayCursor = isPanDragging ? 'grabbing' : panMode || spacePanActive ? 'grab' : zoomWindowMode ? 'zoom-in' : (getTool(tool)?.cursor ?? 'crosshair');

  return (
    <div className={`app${isDragOver ? ' drag-over' : ''}`} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} hidden aria-label="Open PDF file" />
      <input ref={sidecarInputRef} type="file" accept="application/json,.json,.kpdf.json" onChange={handleSidecarFileChange} hidden aria-label="Import sidecar annotations" />
      <input ref={xfdfInputRef} type="file" accept=".xfdf,application/xml,text/xml" onChange={handleXfdfFileChange} hidden aria-label="Import XFDF annotations" />

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
            panMode={panMode} zoomWindowMode={zoomWindowMode} color={color}
            onToolClick={handleToolClick} onToolDoubleClick={handleToolDoubleClick}
            onTogglePan={togglePanMode} onToggleZoomWindow={toggleZoomWindow}
            onSetColor={setColor}
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
          className={`canvas-shell${(panMode || spacePanActive || isPanDragging) ? ' pan-ready' : ''}${isPanDragging ? ' panning' : ''}${zoomWindowMode ? ' zoom-window-mode' : ''}`}
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
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            <div className="page-wrap" style={{ transform: `translate(${panX}px, ${panY}px) scale(${renderedZoomRef.current > 0 ? zoom / renderedZoomRef.current : 1})` }}>
              <canvas ref={pdfCanvasRef} className="pdf-canvas" />
              <canvas ref={overlayCanvasRef} className="overlay-canvas" style={{ cursor: overlayCursor }}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
              <SelectionHandles selection={selection} annotations={currentAnnotations}
                canvasWidth={overlayCanvasRef.current?.width ?? 0} canvasHeight={overlayCanvasRef.current?.height ?? 0}
                canvasRect={canvasRect} onHandleDown={handleHandleDown} />
            </div>
          )}
          {zoomWindowRect && (
            <div className="zoom-window-rect" style={{
              left: zoomWindowRect.x, top: zoomWindowRect.y,
              width: zoomWindowRect.w, height: zoomWindowRect.h,
            }} />
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
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M20 8v24M8 20h24" />
            </svg>
            <span>Drop PDF to open</span>
          </div>
        </div>
      )}
    </div>
  );
}
