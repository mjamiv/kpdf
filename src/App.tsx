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
import type { Annotation, AnnotationsByPage, AnchorPosition, Point, Tool } from './types';
import { annotationReducer, computeInverse, type DocumentState } from './engine/state';
import type { Action } from './engine/actions';
import { createUndoStack, type UndoStack } from './engine/history';
import { clamp01, nextZIndex, randomId, sortedAnnotations } from './engine/utils';
import { createSelectionState, deselectAll, type SelectionState } from './engine/selection';
import { getTool } from './tools';
import { getToolForKey, TOOL_SHORTCUTS } from './tools/shortcuts';
import SelectionHandles from './components/SelectionHandles';
import ShortcutHelpPanel from './components/ShortcutHelpPanel';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import type { DocumentTab } from './workflow/documentStore';
import { createDocumentTab } from './workflow/documentStore';

type TabData = {
  pdfDoc: PDFDocumentProxy;
  sourceBytes: Uint8Array;
  history: UndoStack;
  author: string;
};

GlobalWorkerOptions.workerSrc = workerUrl;

const BASE_RENDER_SCALE = 1.4;

function baseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '') || 'document';
}

function drawAnnotations(
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  draft: unknown,
  activeTool: Tool,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const drawPen = (points: Point[], color: string, thickness: number) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x * w, points[0].y * h);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x * w, points[i].y * h);
    }
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(thickness * w, 1.5);
    ctx.stroke();
  };

  const drawRect = (
    annotation: { type: string; color: string; x: number; y: number; width: number; height: number; thickness: number },
  ) => {
    const x = annotation.x * w;
    const y = annotation.y * h;
    const rw = annotation.width * w;
    const rh = annotation.height * h;
    if (annotation.type === 'highlight') {
      ctx.save();
      ctx.fillStyle = annotation.color;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x, y, rw, rh);
      ctx.restore();
      return;
    }
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = Math.max(annotation.thickness * w, 1.5);
    ctx.strokeRect(x, y, rw, rh);
  };

  const drawArrowShape = (start: Point, end: Point, color: string, thickness: number, headSize: number) => {
    const sx = start.x * w, sy = start.y * h;
    const ex = end.x * w, ey = end.y * h;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(thickness * w, 1.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const angle = Math.atan2(ey - sy, ex - sx);
    const hl = headSize * w;
    ctx.beginPath();
    ctx.moveTo(ex - hl * Math.cos(angle - Math.PI / 6), ey - hl * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - hl * Math.cos(angle + Math.PI / 6), ey - hl * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const drawStampShape = (x: number, y: number, sw: number, sh: number, label: string, color: string) => {
    const px = x * w, py = y * h, pw = sw * w, ph = sh * h;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(12, ph * 0.6)}px ui-sans-serif, system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + pw / 2, py + ph / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  };

  sortedAnnotations(annotations).forEach((ann) => {
    switch (ann.type) {
      case 'pen':
        drawPen(ann.points, ann.color, ann.thickness);
        break;
      case 'rectangle':
      case 'highlight':
        drawRect(ann);
        break;
      case 'text':
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(ann.fontSize * w, 12)}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillText(ann.text, ann.x * w, ann.y * h);
        break;
      case 'arrow':
        drawArrowShape(ann.start, ann.end, ann.color, ann.thickness, ann.headSize);
        break;
      case 'measurement': {
        const sx = ann.start.x * w, sy = ann.start.y * h;
        const ex = ann.end.x * w, ey = ann.end.y * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        const dist = Math.sqrt((ann.end.x - ann.start.x) ** 2 + (ann.end.y - ann.start.y) ** 2) * ann.scale;
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(12, 0.014 * w)}px ui-sans-serif, system-ui`;
        ctx.fillText(`${dist.toFixed(1)} ${ann.unit}`, (sx + ex) / 2 + 4, (sy + ey) / 2 - 4);
        break;
      }
      case 'cloud': {
        const cx = ann.x * w, cy = ann.y * h, cw = ann.width * w, ch = ann.height * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(0.0025 * w, 1.5);
        ctx.strokeRect(cx, cy, cw, ch);
        break;
      }
      case 'polygon':
        if (ann.points.length >= 2) {
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h);
          for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h);
          if (ann.closed) ctx.closePath();
          ctx.stroke();
          if (ann.closed) { ctx.save(); ctx.fillStyle = ann.color; ctx.globalAlpha = 0.1; ctx.fill(); ctx.restore(); }
        }
        break;
      case 'stamp':
        drawStampShape(ann.x, ann.y, ann.width, ann.height, ann.label, ann.color);
        break;
      case 'callout': {
        const bx = ann.box.x * w, by = ann.box.y * h, bw = ann.box.width * w, bh = ann.box.height * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(0.0025 * w, 1.5);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.beginPath(); ctx.moveTo(bx, by + bh / 2); ctx.lineTo(ann.leaderTarget.x * w, ann.leaderTarget.y * h); ctx.stroke();
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(10, ann.fontSize * w)}px ui-sans-serif, system-ui`;
        ctx.fillText(ann.text, bx + 4, by + bh / 2 + 4, bw - 8);
        break;
      }
    }
  });

  if (draft) {
    const toolBehavior = getTool(activeTool);
    toolBehavior?.renderDraft?.(ctx, draft, w, h);
  }
}

const initialState: DocumentState = { annotationsByPage: {} };

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidecarInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeRenderRef = useRef<{ cancel: () => void } | null>(null);
  const historyRef = useRef(createUndoStack());
  const draftRef = useRef<unknown>(null);
  const tabDataRef = useRef<Map<string, TabData>>(new Map());

  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [author, setAuthor] = useState('local-user');
  const [flattenOnSave, setFlattenOnSave] = useState(false);
  const [state, dispatchRaw] = useReducer(annotationReducer, initialState);
  const [draft, setDraftState] = useState<unknown>(null);
  const [selection, setSelection] = useState<SelectionState>(createSelectionState);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Drop a PDF or click Open PDF.');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const pdfDoc = activeTab ? tabDataRef.current.get(activeTab.id)?.pdfDoc ?? null : null;
  const sourceBytes = activeTab ? tabDataRef.current.get(activeTab.id)?.sourceBytes ?? null : null;
  const documentFingerprint = activeTab?.fingerprint ?? '';
  const fileName = activeTab?.fileName ?? '';
  const pageNumber = activeTab?.pageNumber ?? 1;
  const pageCount = activeTab?.pageCount ?? 0;
  const zoom = activeTab?.zoom ?? 1;

  const { annotationsByPage } = state;

  const updateActiveTab = useCallback((updater: (tab: DocumentTab) => DocumentTab) => {
    setTabs((prev) => prev.map((t) => t.id === activeTabId ? updater(t) : t));
  }, [activeTabId]);

  const setPageNumber = useCallback((v: number | ((prev: number) => number)) => {
    updateActiveTab((t) => {
      const next = typeof v === 'function' ? v(t.pageNumber) : v;
      return { ...t, pageNumber: next };
    });
  }, [updateActiveTab]);

  const setZoom = useCallback((v: number | ((prev: number) => number)) => {
    updateActiveTab((t) => {
      const next = typeof v === 'function' ? v(t.zoom) : v;
      return { ...t, zoom: next };
    });
  }, [updateActiveTab]);

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

  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: Action, coalesceKey?: string) => {
    const inverse = computeInverse(stateRef.current, action);
    historyRef.current.push({ forward: action, inverse, timestamp: Date.now(), coalesceKey });
    dispatchRaw(action);
    // Mark active tab dirty
    setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, dirty: true } : t));
  }, [activeTabId]);

  const dispatchSilent = useCallback((action: Action) => { dispatchRaw(action); }, []);

  const currentAnnotations = useMemo(
    () => sortedAnnotations(annotationsByPage[pageNumber] ?? []),
    [annotationsByPage, pageNumber],
  );

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    drawAnnotations(overlay, currentAnnotations, draft, tool);
  }, [currentAnnotations, draft, tool]);

  useEffect(() => {
    if (!pdfDoc || !documentFingerprint) return;
    const doc = createAnnotationDocument(annotationsByPage, author, documentFingerprint);
    saveAnnotationsToLocalStorage(documentFingerprint, doc);
    // Keep tab's annotationsByPage in sync
    if (activeTabId) {
      setTabs((prev) => prev.map((t) =>
        t.id === activeTabId ? { ...t, annotationsByPage } : t
      ));
    }
  }, [annotationsByPage, author, documentFingerprint, pdfDoc, activeTabId]);

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
      }
    };
    renderPage().catch((e) => { setStatus(`Render error: ${(e as Error).message}`); setIsBusy(false); });
    return () => { isCurrent = false; activeRenderRef.current?.cancel(); };
  }, [pdfDoc, pageNumber, zoom, annotationsByPage, draft, tool]);

  const toNormalizedPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  };

  const makeToolCtx = useCallback(() => ({
    dispatch,
    page: pageNumber,
    color,
    author: author.trim() || 'local-user',
    annotations: currentAnnotations,
    selection,
    draft: draftRef.current,
    setDraft,
    setSelection,
    nextZIndex: () => nextZIndex(currentAnnotations),
    randomId,
  }), [dispatch, pageNumber, color, author, currentAnnotations, selection, setDraft]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerDown(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerMove(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerUp(makeToolCtx(), { point: toNormalizedPoint(event), shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!pdfDoc) return;
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const inv = historyRef.current.undo();
        if (inv) dispatchSilent(inv);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const fwd = historyRef.current.redo();
        if (fwd) dispatchSilent(fwd);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.ids.size > 0) {
        e.preventDefault();
        for (const id of selection.ids) {
          const ann = currentAnnotations.find((a) => a.id === id);
          if (ann && !ann.locked) dispatch({ type: 'REMOVE_ANNOTATION', page: pageNumber, id, removed: ann });
        }
        setSelection(deselectAll());
        return;
      }
      if (e.key === '[' && selection.ids.size > 0) { e.preventDefault(); for (const id of selection.ids) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'down' }); return; }
      if (e.key === ']' && selection.ids.size > 0) { e.preventDefault(); for (const id of selection.ids) dispatch({ type: 'SET_Z_ORDER', page: pageNumber, id, op: 'up' }); return; }
      if (e.key === '?') { setShowShortcuts((v) => !v); return; }

      const newTool = getToolForKey(e.key);
      if (newTool) { setTool(newTool); setDraft(null); if (newTool !== 'select') setSelection(deselectAll()); }

      const at = getTool(tool);
      if (at?.onKeyDown) at.onKeyDown(makeToolCtx(), e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pdfDoc, tool, selection, currentAnnotations, pageNumber, dispatch, dispatchSilent, setDraft, makeToolCtx]);

  const handleHandleDown = useCallback((_anchor: AnchorPosition, e: React.PointerEvent) => { e.preventDefault(); }, []);

  const switchToTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    // Save current tab state
    if (activeTabId) {
      const oldData = tabDataRef.current.get(activeTabId);
      if (oldData) oldData.history = historyRef.current;
      setTabs((prev) => prev.map((t) =>
        t.id === activeTabId ? { ...t, annotationsByPage: state.annotationsByPage } : t
      ));
    }
    // Restore new tab state
    setActiveTabId(tabId);
    const newTab = tabs.find((t) => t.id === tabId);
    const newData = tabDataRef.current.get(tabId);
    if (newTab && newData) {
      dispatchRaw({ type: 'RESET_STATE', annotationsByPage: newTab.annotationsByPage });
      historyRef.current = newData.history;
      setAuthor(newData.author);
    }
    setDraft(null);
    setSelection(deselectAll());
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
    setDraft(null);
    setSelection(deselectAll());
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

    // Save current tab state before switching
    if (activeTabId) {
      const oldData = tabDataRef.current.get(activeTabId);
      if (oldData) oldData.history = historyRef.current;
      setTabs((prev) => prev.map((t) =>
        t.id === activeTabId ? { ...t, annotationsByPage: state.annotationsByPage } : t
      ));
    }

    // Create new tab
    const tabId = randomId();
    const newTab = createDocumentTab(tabId, name, fingerprint, doc.numPages);
    newTab.annotationsByPage = loadedAnnotations;
    const newHistory = createUndoStack();
    tabDataRef.current.set(tabId, { pdfDoc: doc, sourceBytes: bytes, history: newHistory, author: loadedAuthor });

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    setAuthor(loadedAuthor);
    historyRef.current = newHistory;

    // Load annotations into reducer
    dispatchRaw({ type: 'RESET_STATE', annotationsByPage: loadedAnnotations });
    setDraft(null);
    setSelection(deselectAll());
    setStatus(`Loaded ${name} (${doc.numPages} pages) with ${loadedSource}.`);
    setIsBusy(false);
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
    const file = event.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') { setStatus('Drop a valid PDF file.'); return; }
    try { await loadPdf(new Uint8Array(await file.arrayBuffer()), file.name); }
    catch (e) { setStatus(`Drop error: ${(e as Error).message}`); setIsBusy(false); }
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

  const handleUndo = () => { const inv = historyRef.current.undo(); if (inv) dispatchSilent(inv); };
  const handleRedo = () => { const fwd = historyRef.current.redo(); if (fwd) dispatchSilent(fwd); };
  const clearPage = () => {
    const removed = currentAnnotations.filter((a) => !a.locked);
    if (removed.length > 0) dispatch({ type: 'CLEAR_PAGE', page: pageNumber, removed });
  };

  const toolbarTools: Tool[] = ['select', 'pen', 'rectangle', 'highlight', 'text', 'arrow', 'callout', 'cloud', 'measurement', 'polygon', 'stamp'];
  const toolLabel = (t: Tool) => TOOL_SHORTCUTS.find((s) => s.tool === t)?.label ?? t;

  return (
    <div className="app" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <header className="toolbar">
        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} hidden />
        <input ref={sidecarInputRef} type="file" accept="application/json,.json,.kpdf.json" onChange={handleSidecarFileChange} hidden />
        <button onClick={() => fileInputRef.current?.click()}>Open PDF</button>
        <button onClick={() => sidecarInputRef.current?.click()} disabled={!pdfDoc || isBusy}>Import Sidecar</button>
        <button onClick={savePdf} disabled={!pdfDoc || isBusy}>Save PDF</button>
        <label className="toggle-row">
          <input type="checkbox" checked={flattenOnSave} onChange={(e) => setFlattenOnSave(e.target.checked)} disabled={!pdfDoc || isBusy} />
          Flatten
        </label>
        <span className="divider" />
        {toolbarTools.map((id) => (
          <button key={id} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setDraft(null); if (id !== 'select') setSelection(deselectAll()); }} disabled={!pdfDoc} title={toolLabel(id)}>
            {toolLabel(id)}
          </button>
        ))}
        <input className="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!pdfDoc} title="Markup color" />
        <label className="author-row">
          Author
          <input className="author-input" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={!pdfDoc} />
        </label>
        <span className="divider" />
        <button onClick={handleUndo} disabled={!pdfDoc} title="Undo (Ctrl+Z)">Undo</button>
        <button onClick={handleRedo} disabled={!pdfDoc} title="Redo (Ctrl+Shift+Z)">Redo</button>
        <button onClick={clearPage} disabled={!pdfDoc}>Clear Page</button>
        <button onClick={() => setShowShortcuts((v) => !v)} title="Shortcuts (?)">?</button>
        <span className="divider" />
        <button onClick={() => setZoom((v) => Math.max(0.5, +(v - 0.1).toFixed(2)))} disabled={!pdfDoc}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((v) => Math.min(3, +(v + 0.1).toFixed(2)))} disabled={!pdfDoc}>+</button>
        <span className="divider" />
        <button onClick={() => { setDraft(null); setPageNumber((v) => Math.max(1, v - 1)); }} disabled={!pdfDoc || pageNumber <= 1}>Prev</button>
        <span>{pageNumber} / {pageCount || 0}</span>
        <button onClick={() => { setDraft(null); setPageNumber((v) => Math.min(pageCount, v + 1)); }} disabled={!pdfDoc || pageNumber >= pageCount}>Next</button>
      </header>
      <TabBar tabs={tabs} activeTabId={activeTabId} onSelectTab={switchToTab} onCloseTab={closeTab} />
      <main className="canvas-shell">
        {!pdfDoc ? (
          <div className="empty-state"><h1>KPDF Markup</h1><p>Open or drop a PDF to start marking up.</p></div>
        ) : (
          <div className="page-wrap">
            <canvas ref={pdfCanvasRef} className="pdf-canvas" />
            <canvas ref={overlayCanvasRef} className="overlay-canvas" style={{ cursor: getTool(tool)?.cursor ?? 'crosshair' }}
              onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
            <SelectionHandles selection={selection} annotations={currentAnnotations}
              canvasWidth={overlayCanvasRef.current?.width ?? 0} canvasHeight={overlayCanvasRef.current?.height ?? 0}
              canvasRect={canvasRect} onHandleDown={handleHandleDown} />
          </div>
        )}
      </main>
      <StatusBar status={status} />
      <ShortcutHelpPanel visible={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
