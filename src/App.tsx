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
import { clamp01, nextZIndex, pointsBoundingBox, randomId, sortedAnnotations } from './engine/utils';
import { createSelectionState, deselectAll, type SelectionState } from './engine/selection';
import { getTool } from './tools';
import { getToolForKey, TOOL_SHORTCUTS } from './tools/shortcuts';
import SelectionHandles from './components/SelectionHandles';
import ShortcutHelpPanel from './components/ShortcutHelpPanel';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import type { DocumentTab } from './workflow/documentStore';
import { createDocumentTab } from './workflow/documentStore';
import CommentsPanel from './components/CommentsPanel';
import MarkupsList from './components/MarkupsList';
import { createReviewState, isToolAllowed, type ReviewState } from './workflow/reviewMode';
import { isTextDraft, FONT_SIZE as TEXT_FONT_SIZE } from './tools/textTool';
import getStroke from 'perfect-freehand';
import { getActiveStamp, setActiveStamp, getCachedImage } from './tools/stampTool';
import StampPicker from './components/StampPicker';
import ToolPresets from './components/ToolPresets';
import type { ToolPreset } from './components/ToolPresets';
import ScaleCalibrationPanel from './components/ScaleCalibrationPanel';

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

type SelectDraftInfo = {
  toolType: 'select';
  isDragging: boolean;
  totalDx: number;
  totalDy: number;
};

function isSelectDraft(d: unknown): d is SelectDraftInfo {
  return d !== null && typeof d === 'object' && (d as SelectDraftInfo).toolType === 'select';
}

function applyDragOffset(ann: Annotation, dx: number, dy: number): Annotation {
  switch (ann.type) {
    case 'pen':
    case 'polygon':
    case 'area':
    case 'polyline':
      return { ...ann, points: ann.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case 'rectangle':
    case 'highlight':
    case 'text':
    case 'cloud':
    case 'stamp':
    case 'ellipse':
      return { ...ann, x: ann.x + dx, y: ann.y + dy };
    case 'arrow':
    case 'measurement':
    case 'dimension':
      return { ...ann, start: { x: ann.start.x + dx, y: ann.start.y + dy }, end: { x: ann.end.x + dx, y: ann.end.y + dy } };
    case 'callout':
      return { ...ann, box: { ...ann.box, x: ann.box.x + dx, y: ann.box.y + dy }, leaderTarget: { x: ann.leaderTarget.x + dx, y: ann.leaderTarget.y + dy } };
    case 'angle':
      return { ...ann, vertex: { x: ann.vertex.x + dx, y: ann.vertex.y + dy }, ray1: { x: ann.ray1.x + dx, y: ann.ray1.y + dy }, ray2: { x: ann.ray2.x + dx, y: ann.ray2.y + dy } };
    case 'count':
      return { ...ann, x: ann.x + dx, y: ann.y + dy };
    default:
      return ann;
  }
}

function getBoundingBox(ann: Annotation): { x: number; y: number; w: number; h: number } | null {
  switch (ann.type) {
    case 'rectangle':
    case 'highlight':
    case 'cloud':
    case 'stamp':
    case 'ellipse':
      return { x: ann.x, y: ann.y, w: ann.width, h: ann.height };
    case 'text':
      return { x: ann.x, y: ann.y - 0.02, w: 0.1, h: 0.025 };
    case 'pen':
    case 'polygon':
    case 'area':
    case 'polyline': {
      const bb = pointsBoundingBox(ann.points);
      return { x: bb.minX, y: bb.minY, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY };
    }
    case 'arrow':
    case 'measurement':
    case 'dimension': {
      const bb = pointsBoundingBox([ann.start, ann.end]);
      return { x: bb.minX, y: bb.minY, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY };
    }
    case 'callout':
      return { x: ann.box.x, y: ann.box.y, w: ann.box.width, h: ann.box.height };
    case 'angle': {
      const bb = pointsBoundingBox([ann.vertex, ann.ray1, ann.ray2]);
      return { x: bb.minX, y: bb.minY, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY };
    }
    case 'count':
      return { x: ann.x - ann.radius, y: ann.y - ann.radius, w: ann.radius * 2, h: ann.radius * 2 };
    default:
      return null;
  }
}

function drawAnnotations(
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  draft: unknown,
  activeTool: Tool,
  selectedIds?: Set<string>,
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

  const drawStampShape = (x: number, y: number, sw: number, sh: number, label: string, color: string, imageUrl?: string) => {
    const px = x * w, py = y * h, pw = sw * w, ph = sh * h;
    if (imageUrl) {
      const img = getCachedImage(imageUrl);
      if (img) {
        ctx.drawImage(img, px, py, pw, ph);
        return;
      }
    }
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

  const dragDraft = isSelectDraft(draft) && draft.isDragging ? draft : null;

  sortedAnnotations(annotations).forEach((rawAnn) => {
    // Apply visual drag offset to selected annotations
    let ann = rawAnn;
    if (dragDraft && selectedIds?.has(rawAnn.id)) {
      const dx = dragDraft.totalDx;
      const dy = dragDraft.totalDy;
      ann = applyDragOffset(rawAnn, dx, dy);
    }
    // Locked annotation visual indicator
    if (ann.locked) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(120, 120, 120, 0.5)';
      ctx.lineWidth = 1;
      // Draw a dashed border around the annotation's bounding area
      const bb = getBoundingBox(ann);
      if (bb) {
        ctx.strokeRect(bb.x * w - 2, bb.y * h - 2, bb.w * w + 4, bb.h * h + 4);
        // Draw small lock indicator
        const lx = bb.x * w + bb.w * w - 6;
        const ly = bb.y * h - 8;
        ctx.fillStyle = 'rgba(120, 120, 120, 0.7)';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.fillText('\u{1F512}', lx, ly);
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    switch (ann.type) {
      case 'pen':
        if (ann.strokeWidths && ann.strokeWidths.length > 0) {
          // Render variable-width stroke using perfect-freehand
          const inputPts = ann.points.map((p: Point) => [p.x * w, p.y * h]);
          const outline = getStroke(inputPts, {
            size: ann.thickness * w,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
          });
          if (outline.length >= 2) {
            const path = new Path2D();
            path.moveTo(outline[0][0], outline[0][1]);
            for (let i = 1; i < outline.length; i++) path.lineTo(outline[i][0], outline[i][1]);
            path.closePath();
            ctx.fillStyle = ann.color;
            ctx.fill(path);
          }
        } else {
          drawPen(ann.points, ann.color, ann.thickness);
        }
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
        drawStampShape(ann.x, ann.y, ann.width, ann.height, ann.label, ann.color, ann.imageUrl);
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
      case 'area': {
        if (ann.points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h);
          for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h);
          ctx.closePath();
          ctx.save();
          ctx.fillStyle = ann.color;
          ctx.globalAlpha = 0.15;
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
          ctx.stroke();
          // Area label at centroid
          let acx = 0, acy = 0;
          for (const p of ann.points) { acx += p.x; acy += p.y; }
          acx /= ann.points.length; acy /= ann.points.length;
          const areaVal = (() => { let s = 0; for (let i = 0; i < ann.points.length; i++) { const j = (i + 1) % ann.points.length; s += ann.points[i].x * ann.points[j].y - ann.points[j].x * ann.points[i].y; } return Math.abs(s) / 2 * ann.scale; })();
          ctx.fillStyle = ann.color;
          ctx.font = `${Math.max(12, 0.014 * w)}px ui-sans-serif, system-ui`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${areaVal.toFixed(2)} ${ann.unit}`, acx * w, acy * h);
          ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
        break;
      }
      case 'angle': {
        const vx = ann.vertex.x * w, vy = ann.vertex.y * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
        // Ray 1
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(ann.ray1.x * w, ann.ray1.y * h); ctx.stroke();
        // Ray 2
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(ann.ray2.x * w, ann.ray2.y * h); ctx.stroke();
        // Arc
        const a1 = Math.atan2(ann.ray1.y - ann.vertex.y, ann.ray1.x - ann.vertex.x);
        const a2 = Math.atan2(ann.ray2.y - ann.vertex.y, ann.ray2.x - ann.vertex.x);
        ctx.beginPath(); ctx.arc(vx, vy, 20, a1, a2); ctx.stroke();
        // Degree label
        let angleDeg = Math.abs(a1 - a2) * (180 / Math.PI);
        if (angleDeg > 180) angleDeg = 360 - angleDeg;
        const midA = (a1 + a2) / 2;
        ctx.fillStyle = ann.color;
        ctx.font = `${Math.max(12, 0.014 * w)}px ui-sans-serif, system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${angleDeg.toFixed(1)}°`, vx + 32 * Math.cos(midA), vy + 32 * Math.sin(midA));
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        break;
      }
      case 'count': {
        const ccx = ann.x * w, ccy = ann.y * h, cr = ann.radius * w;
        ctx.beginPath();
        ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
        ctx.fillStyle = ann.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, cr)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${ann.number}`, ccx, ccy);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        break;
      }
      case 'dimension': {
        const ddx = ann.end.x - ann.start.x;
        const ddy = ann.end.y - ann.start.y;
        const dLen = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dLen > 0) {
          const nx = -ddy / dLen, ny = ddx / dLen;
          const os = ann.offset;
          const s = { x: ann.start.x + nx * os, y: ann.start.y + ny * os };
          const e = { x: ann.end.x + nx * os, y: ann.end.y + ny * os };
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
          // Main line
          ctx.beginPath(); ctx.moveTo(s.x * w, s.y * h); ctx.lineTo(e.x * w, e.y * h); ctx.stroke();
          // Tick marks
          const ts = 0.008 * w;
          ctx.beginPath(); ctx.moveTo(s.x * w - nx * ts, s.y * h - ny * ts); ctx.lineTo(s.x * w + nx * ts, s.y * h + ny * ts); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(e.x * w - nx * ts, e.y * h - ny * ts); ctx.lineTo(e.x * w + nx * ts, e.y * h + ny * ts); ctx.stroke();
          // Extension lines
          ctx.save(); ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ann.start.x * w, ann.start.y * h); ctx.lineTo(s.x * w, s.y * h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ann.end.x * w, ann.end.y * h); ctx.lineTo(e.x * w, e.y * h); ctx.stroke();
          ctx.restore();
          // Label
          const dist = dLen * ann.scale;
          ctx.fillStyle = ann.color;
          ctx.font = `${Math.max(12, 0.014 * w)}px ui-sans-serif, system-ui`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(`${dist.toFixed(1)} ${ann.unit}`, (s.x + e.x) / 2 * w, (s.y + e.y) / 2 * h - 4);
          ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
        break;
      }
      case 'ellipse': {
        const ecx = (ann.x + ann.width / 2) * w;
        const ecy = (ann.y + ann.height / 2) * h;
        const erx = ann.width / 2 * w;
        const ery = ann.height / 2 * h;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, Math.abs(erx), Math.abs(ery), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'polyline': {
        if (ann.points.length >= 2) {
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = Math.max(ann.thickness * w, 1.5);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h);
          for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h);
          ctx.stroke();
        }
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
  const [showComments, setShowComments] = useState(false);
  const [showMarkupsList, setShowMarkupsList] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewState>(createReviewState);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeStampId, setActiveStampId] = useState(getActiveStamp().id);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showToolPresets, setShowToolPresets] = useState(false);
  const [showScalePanel, setShowScalePanel] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const pdfDoc = activeTab ? tabDataRef.current.get(activeTab.id)?.pdfDoc ?? null : null;
  const sourceBytes = activeTab ? tabDataRef.current.get(activeTab.id)?.sourceBytes ?? null : null;
  const documentFingerprint = activeTab?.fingerprint ?? '';
  const fileName = activeTab?.fileName ?? '';
  const pageNumber = activeTab?.pageNumber ?? 1;
  const pageCount = activeTab?.pageCount ?? 0;
  const zoom = activeTab?.zoom ?? 1;
  const currentPageScale: PageScale | null = activeTab?.pageScales[activeTab.pageNumber] ?? null;

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

  const setPageScale = useCallback((scale: PageScale | null) => {
    updateActiveTab((t) => {
      const ps = { ...t.pageScales };
      if (scale) {
        ps[t.pageNumber] = scale;
      } else {
        delete ps[t.pageNumber];
      }
      return { ...t, pageScales: ps };
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
  const savePdfRef = useRef<() => void>(() => {});
  const closeTabRef = useRef<(id: string) => void>(() => {});

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
    drawAnnotations(overlay, currentAnnotations, draft, tool, selection.ids);
  }, [currentAnnotations, draft, tool, selection]);

  // Keep canvasRect up to date on window resize
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const observer = new ResizeObserver(() => {
      setCanvasRect(overlay.getBoundingClientRect());
    });
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [pdfDoc, pageNumber]);

  useEffect(() => {
    if (!pdfDoc || !documentFingerprint) return;
    // Keep tab's annotationsByPage in sync (immediate)
    if (activeTabId) {
      setTabs((prev) => prev.map((t) =>
        t.id === activeTabId ? { ...t, annotationsByPage } : t
      ));
    }
    // Debounce localStorage write to avoid blocking during drawing/dragging
    const timer = setTimeout(() => {
      const doc = createAnnotationDocument(annotationsByPage, author, documentFingerprint);
      saveAnnotationsToLocalStorage(documentFingerprint, doc);
    }, 1500);
    return () => clearTimeout(timer);
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
      if (isCurrent) setIsBusy(false);
    };
    renderPage().catch((e) => { setStatus(`Render error: ${(e as Error).message}`); setIsBusy(false); });
    return () => { isCurrent = false; activeRenderRef.current?.cancel(); };
  }, [pdfDoc, pageNumber, zoom]);

  const canvasRectRef = useRef(canvasRect);
  canvasRectRef.current = canvasRect;

  const toNormalizedPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRectRef.current;
    if (!rect) return { x: 0, y: 0 };
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
    pageScale: currentPageScale ?? undefined,
  }), [dispatch, pageNumber, color, author, currentAnnotations, selection, setDraft, currentPageScale]);

  const toNormalizedEvent = (event: React.PointerEvent<HTMLCanvasElement>) => ({
    point: toNormalizedPoint(event),
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerDown(makeToolCtx(), toNormalizedEvent(event));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerMove(makeToolCtx(), toNormalizedEvent(event));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;
    const activeTool = getTool(tool);
    if (!activeTool) return;
    activeTool.onPointerUp(makeToolCtx(), toNormalizedEvent(event));
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
      if (e.key === 'Escape') { setShowShortcuts(false); setDraft(null); return; }
      if (e.key === '?') { setShowShortcuts((v) => !v); return; }

      // Standard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (pdfDoc && !isBusy) savePdfRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) closeTabRef.current(activeTabId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((v) => Math.min(3, +(v + 0.1).toFixed(2)));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom((v) => Math.max(0.5, +(v - 0.1).toFixed(2)));
        return;
      }
      if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        if (pageNumber < pageCount) { e.preventDefault(); setDraft(null); setPageNumber((v) => Math.min(pageCount, v + 1)); }
        return;
      }
      if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        if (pageNumber > 1) { e.preventDefault(); setDraft(null); setPageNumber((v) => Math.max(1, v - 1)); }
        return;
      }

      const newTool = getToolForKey(e.key);
      if (newTool && isToolAllowed(newTool, reviewMode)) { setTool(newTool); setDraft(null); if (newTool !== 'select') setSelection(deselectAll()); }

      const at = getTool(tool);
      if (at?.onKeyDown) at.onKeyDown(makeToolCtx(), e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pdfDoc, tool, selection, currentAnnotations, pageNumber, pageCount, dispatch, dispatchSilent, setDraft, makeToolCtx, reviewMode, isBusy, activeTabId, setZoom, setPageNumber]);

  // beforeunload guard for unsaved changes
  useEffect(() => {
    const hasDirty = tabs.some((t) => t.dirty);
    if (!hasDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [tabs]);

  const handleHandleDown = useCallback((anchor: AnchorPosition, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const overlay = overlayCanvasRef.current;
    if (!overlay || selection.ids.size === 0) return;
    const rect = overlay.getBoundingClientRect();
    let lastX = (e.clientX - rect.left) / rect.width;
    let lastY = (e.clientY - rect.top) / rect.height;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const nx = (ev.clientX - rect.left) / rect.width;
      const ny = (ev.clientY - rect.top) / rect.height;
      const dx = nx - lastX;
      const dy = ny - lastY;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        for (const id of selection.ids) {
          dispatch({ type: 'RESIZE_ANNOTATION', page: pageNumber, id, anchor, dx, dy });
        }
        lastX = nx;
        lastY = ny;
      }
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.releasePointerCapture(e.pointerId);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [selection, pageNumber, dispatch]);

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
  closeTabRef.current = closeTab;

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
    setIsDragOver(false);
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
  savePdfRef.current = savePdf;

  const handleUndo = () => { const inv = historyRef.current.undo(); if (inv) dispatchSilent(inv); };
  const handleRedo = () => { const fwd = historyRef.current.redo(); if (fwd) dispatchSilent(fwd); };
  const clearPage = () => {
    const removed = currentAnnotations.filter((a) => !a.locked);
    if (removed.length === 0) return;
    if (!window.confirm(`Clear ${removed.length} annotation${removed.length > 1 ? 's' : ''} on this page?`)) return;
    dispatch({ type: 'CLEAR_PAGE', page: pageNumber, removed });
  };

  const commitTextDraft = useCallback((text: string) => {
    const d = draftRef.current;
    if (!isTextDraft(d)) return;
    if (text.trim()) {
      const timestamp = new Date().toISOString();
      dispatch({
        type: 'ADD_ANNOTATION',
        page: pageNumber,
        annotation: {
          id: randomId(),
          zIndex: nextZIndex(currentAnnotations),
          color: d.color,
          author: d.author,
          createdAt: timestamp,
          updatedAt: timestamp,
          locked: false,
          type: 'text',
          text: text.trim(),
          x: d.x,
          y: d.y,
          fontSize: TEXT_FONT_SIZE,
        },
      });
    }
    setDraft(null);
  }, [dispatch, pageNumber, currentAnnotations, setDraft]);

  const textDraft = isTextDraft(draft) ? draft : null;

  const toolbarTools: Tool[] = ['select', 'pen', 'rectangle', 'highlight', 'text', 'arrow', 'callout', 'cloud', 'measurement', 'polygon', 'stamp', 'area', 'angle', 'count', 'dimension'];
  const toolLabel = (t: Tool) => TOOL_SHORTCUTS.find((s) => s.tool === t)?.label ?? t;
  const toolShortLabel: Record<string, string> = {
    select: 'Select', pen: 'Pen', rectangle: 'Rect', highlight: 'Hilite',
    text: 'Text', arrow: 'Arrow', callout: 'Callout', cloud: 'Cloud',
    measurement: 'Measure', polygon: 'Polygon', stamp: 'Stamp',
    area: 'Area', angle: 'Angle', count: 'Count', dimension: 'Dim',
  };

  return (
    <div
      className={`app${isDragOver ? ' drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragOver(false); }}
    >
      <header className="toolbar" role="toolbar" aria-label="Markup tools">
        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} hidden />
        <input ref={sidecarInputRef} type="file" accept="application/json,.json,.kpdf.json" onChange={handleSidecarFileChange} hidden />

        {/* File actions */}
        <div className="action-group">
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>Open</button>
          <button onClick={() => sidecarInputRef.current?.click()} disabled={!pdfDoc || isBusy}>Import</button>
          <button onClick={savePdf} disabled={!pdfDoc || isBusy}>Save</button>
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={flattenOnSave} onChange={(e) => setFlattenOnSave(e.target.checked)} disabled={!pdfDoc || isBusy} />
          Flatten
        </label>

        <span className="divider" />

        {/* Tool palette */}
        <div className="tool-group">
          {toolbarTools.map((id) => (
            <button key={id} className={tool === id ? 'active' : ''} aria-pressed={tool === id} onClick={() => { if (!isToolAllowed(id, reviewMode)) return; setTool(id); setDraft(null); if (id !== 'select') setSelection(deselectAll()); }} disabled={!pdfDoc || !isToolAllowed(id, reviewMode)} title={toolLabel(id)}>
              {toolShortLabel[id] ?? id}
            </button>
          ))}
        </div>

        <input className="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!pdfDoc} title="Markup color" aria-label="Markup color" />
        {tool === 'stamp' && (
          <button
            className="stamp-select"
            onClick={() => setShowStampPicker((v) => !v)}
            aria-label="Select stamp type"
          >
            {getActiveStamp().label}
          </button>
        )}

        <span className="divider" />

        <button onClick={() => setShowToolPresets((v) => !v)} disabled={!pdfDoc} title="Tool Presets">Presets</button>

        <span className="divider" />

        {/* Edit actions */}
        <div className="action-group">
          <button onClick={handleUndo} disabled={!pdfDoc} title="Undo (Ctrl+Z)">Undo</button>
          <button onClick={handleRedo} disabled={!pdfDoc} title="Redo (Ctrl+Shift+Z)">Redo</button>
          <button onClick={clearPage} disabled={!pdfDoc}>Clear</button>
        </div>

        <button onClick={() => setShowShortcuts((v) => !v)} title="Shortcuts (?)" aria-label="Keyboard shortcuts">?</button>

        <span className="divider" />

        {/* Zoom */}
        <div className="action-group">
          <button onClick={() => setZoom((v) => Math.max(0.5, +(v - 0.1).toFixed(2)))} disabled={!pdfDoc} aria-label="Zoom out">-</button>
          <input
            className="zoom-input"
            type="text"
            value={`${Math.round(zoom * 100)}%`}
            disabled={!pdfDoc}
            aria-label="Zoom level"
            onFocus={(e) => { e.target.value = String(Math.round(zoom * 100)); e.target.select(); }}
            onBlur={(e) => { e.target.value = `${Math.round(zoom * 100)}%`; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                if (!isNaN(val)) setZoom(Math.max(50, Math.min(300, val)) / 100);
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
              e.stopPropagation();
            }}
          />
          <button onClick={() => setZoom((v) => Math.min(3, +(v + 0.1).toFixed(2)))} disabled={!pdfDoc} aria-label="Zoom in">+</button>
        </div>

        <span className="divider" />

        {/* Page navigation */}
        <div className="action-group">
          <button onClick={() => { setDraft(null); setPageNumber((v) => Math.max(1, v - 1)); }} disabled={!pdfDoc || pageNumber <= 1} aria-label="Previous page">Prev</button>
          <input
            className="page-input"
            type="text"
            value={pageNumber}
            disabled={!pdfDoc}
            aria-label="Page number"
            onFocus={(e) => e.target.select()}
            onBlur={(e) => { e.target.value = String(pageNumber); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                if (!isNaN(val)) { setDraft(null); setPageNumber(Math.max(1, Math.min(pageCount, val))); }
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
              e.stopPropagation();
            }}
          />
          <span className="page-total">/ {pageCount || 0}</span>
          <button onClick={() => { setDraft(null); setPageNumber((v) => Math.min(pageCount, v + 1)); }} disabled={!pdfDoc || pageNumber >= pageCount} aria-label="Next page">Next</button>
        </div>

        <span className="divider" />

        <label className="author-row">
          Author
          <input className="author-input" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={!pdfDoc} />
        </label>

        <span className="divider" />

        <button
          className={showScalePanel ? 'active' : ''}
          onClick={() => setShowScalePanel((v) => !v)}
          disabled={!pdfDoc}
          title="Scale calibration"
        >
          {currentPageScale ? `Scale: ${currentPageScale.unit}` : 'Scale'}
        </button>

        <span className="divider" />

        {/* Review & Comments */}
        <div className="action-group">
          <button
            className={reviewMode.active ? 'active' : ''}
            onClick={() => {
              setReviewMode((prev) => {
                const next = { active: !prev.active };
                if (next.active) { setTool('select'); setDraft(null); setSelection(deselectAll()); }
                return next;
              });
            }}
            disabled={!pdfDoc}
            title="Toggle review mode (read-only)"
          >
            Review
          </button>
          <button
            className={showComments ? 'active' : ''}
            onClick={() => setShowComments((v) => !v)}
            disabled={!pdfDoc}
            title="Toggle comments panel"
          >
            Comments
          </button>
          <button
            className={showMarkupsList ? 'active' : ''}
            onClick={() => setShowMarkupsList((v) => !v)}
            disabled={!pdfDoc}
            title="Toggle markups list"
          >
            Markups
          </button>
        </div>
      </header>
      <TabBar tabs={tabs} activeTabId={activeTabId} onSelectTab={switchToTab} onCloseTab={closeTab} />
      <main className="canvas-shell">
        {isBusy && <div className="loading-overlay"><div className="spinner" /></div>}
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
            {textDraft && canvasRect && (
              <input
                className="text-input-overlay"
                autoFocus
                style={{
                  left: textDraft.x * canvasRect.width,
                  top: textDraft.y * canvasRect.height,
                  color: textDraft.color,
                  fontSize: Math.max(TEXT_FONT_SIZE * (overlayCanvasRef.current?.width ?? 800), 14),
                }}
                onBlur={(e) => commitTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { commitTextDraft((e.target as HTMLInputElement).value); e.preventDefault(); }
                  if (e.key === 'Escape') { setDraft(null); e.preventDefault(); }
                  e.stopPropagation();
                }}
              />
            )}
          </div>
        )}
      </main>
      <CommentsPanel
        visible={showComments}
        annotationsByPage={annotationsByPage}
        onJumpTo={(page, _annotationId) => {
          setPageNumber(page);
          setDraft(null);
        }}
        onClose={() => setShowComments(false)}
      />
      <MarkupsList
        visible={showMarkupsList}
        annotationsByPage={annotationsByPage}
        onJumpTo={(page, _annotationId) => {
          setPageNumber(page);
          setDraft(null);
        }}
        onClose={() => setShowMarkupsList(false)}
        onUpdateAnnotation={(page, id, patch) => {
          dispatch({ type: 'UPDATE_ANNOTATION', page, id, patch });
        }}
        onDeleteAnnotations={(items) => {
          for (const { page, id } of items) {
            const ann = annotationsByPage[page]?.find((a) => a.id === id);
            if (ann && !ann.locked) dispatch({ type: 'REMOVE_ANNOTATION', page, id, removed: ann });
          }
        }}
      />
      <StatusBar status={status} />
      <ShortcutHelpPanel visible={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <StampPicker
        visible={showStampPicker}
        activeStampId={activeStampId}
        onSelectStamp={(stamp) => { setActiveStamp(stamp); setActiveStampId(stamp.id); }}
        onClose={() => setShowStampPicker(false)}
      />
      <ToolPresets
        visible={showToolPresets}
        currentColor={color}
        currentTool={tool}
        onApplyPreset={(preset: ToolPreset) => { setTool(preset.tool); setColor(preset.color); }}
        onClose={() => setShowToolPresets(false)}
      />
      <ScaleCalibrationPanel
        visible={showScalePanel}
        currentScale={currentPageScale}
        onCalibrate={(scale) => { setPageScale(scale); setShowScalePanel(false); }}
        onClear={() => setPageScale(null)}
        onClose={() => setShowScalePanel(false)}
      />
    </div>
  );
}
