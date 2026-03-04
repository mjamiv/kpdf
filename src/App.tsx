import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { Annotation, AnnotationsByPage, Point, Tool } from './types';

GlobalWorkerOptions.workerSrc = workerUrl;

const BASE_RENDER_SCALE = 1.4;
const PEN_THICKNESS = 0.0025;
const FONT_SIZE = 0.018;

type DraftPen = {
  type: 'pen';
  points: Point[];
};

type DraftRect = {
  type: 'rectangle' | 'highlight';
  start: Point;
  end: Point;
};

type Draft = DraftPen | DraftRect | null;

const toolLabels: Record<Tool, string> = {
  pen: 'Pen',
  rectangle: 'Rectangle',
  highlight: 'Highlight',
  text: 'Text',
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRect(start: Point, end: Point) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function nextZIndex(annotations: Annotation[]): number {
  return annotations.reduce((max, annotation) => Math.max(max, annotation.zIndex), 0) + 1;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '') || 'document';
}

function sortedAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => a.zIndex - b.zIndex);
}

function drawAnnotations(
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  draft: Draft,
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
    annotation: Pick<Annotation, 'type' | 'color'> & { x: number; y: number; width: number; height: number; thickness: number },
  ) => {
    const x = annotation.x * w;
    const y = annotation.y * h;
    const width = annotation.width * w;
    const height = annotation.height * h;

    if (annotation.type === 'highlight') {
      ctx.save();
      ctx.fillStyle = annotation.color;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x, y, width, height);
      ctx.restore();
      return;
    }

    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = Math.max(annotation.thickness * w, 1.5);
    ctx.strokeRect(x, y, width, height);
  };

  sortedAnnotations(annotations).forEach((annotation) => {
    switch (annotation.type) {
      case 'pen':
        drawPen(annotation.points, annotation.color, annotation.thickness);
        break;
      case 'rectangle':
      case 'highlight':
        drawRect(annotation);
        break;
      case 'text':
        ctx.fillStyle = annotation.color;
        ctx.font = `${Math.max(annotation.fontSize * w, 12)}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillText(annotation.text, annotation.x * w, annotation.y * h);
        break;
      default:
        break;
    }
  });

  if (!draft) return;

  if (draft.type === 'pen') {
    drawPen(draft.points, '#111827', PEN_THICKNESS);
    return;
  }

  const rect = normalizeRect(draft.start, draft.end);
  drawRect({
    ...rect,
    type: draft.type,
    color: '#111827',
    thickness: PEN_THICKNESS,
  });
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidecarInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeRenderRef = useRef<{ cancel: () => void } | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [documentFingerprint, setDocumentFingerprint] = useState<string>('');
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [author, setAuthor] = useState('local-user');
  const [flattenOnSave, setFlattenOnSave] = useState(false);
  const [annotationsByPage, setAnnotationsByPage] = useState<AnnotationsByPage>({});
  const [draft, setDraft] = useState<Draft>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Drop a PDF or click Open PDF.');

  const currentAnnotations = useMemo(
    () => sortedAnnotations(annotationsByPage[pageNumber] ?? []),
    [annotationsByPage, pageNumber],
  );

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    drawAnnotations(overlay, currentAnnotations, draft);
  }, [currentAnnotations, draft]);

  useEffect(() => {
    if (!pdfDoc || !documentFingerprint) return;

    const doc = createAnnotationDocument(annotationsByPage, author, documentFingerprint);
    saveAnnotationsToLocalStorage(documentFingerprint, doc);
  }, [annotationsByPage, author, documentFingerprint, pdfDoc]);

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

      const context = pdfCanvas.getContext('2d');
      if (!context) return;

      const renderTask = page.render({ canvasContext: context, viewport, canvas: pdfCanvas });
      activeRenderRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (error) {
        if ((error as Error).name !== 'RenderingCancelledException') {
          throw error;
        }
      }

      if (isCurrent) {
        drawAnnotations(overlayCanvas, annotationsByPage[pageNumber] ?? [], draft);
        setIsBusy(false);
      }
    };

    renderPage().catch((error) => {
      setStatus(`Render error: ${(error as Error).message}`);
      setIsBusy(false);
    });

    return () => {
      isCurrent = false;
      activeRenderRef.current?.cancel();
    };
  }, [pdfDoc, pageNumber, zoom, annotationsByPage, draft]);

  const toNormalizedPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    return { x, y };
  };

  const addAnnotation = (build: (base: Pick<Annotation, 'id' | 'zIndex' | 'color' | 'author' | 'createdAt' | 'updatedAt' | 'locked'>) => Annotation) => {
    const pageAnnotations = annotationsByPage[pageNumber] ?? [];
    const timestamp = new Date().toISOString();
    const base = {
      id: randomId(),
      zIndex: nextZIndex(pageAnnotations),
      color,
      author: author.trim() || 'local-user',
      createdAt: timestamp,
      updatedAt: timestamp,
      locked: false,
    };

    const annotation = build(base);

    setAnnotationsByPage((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] ?? []), annotation],
    }));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pdfDoc) return;

    const point = toNormalizedPoint(event);

    if (tool === 'text') {
      const text = window.prompt('Text markup');
      if (!text || !text.trim()) return;

      addAnnotation((base) => ({
        ...base,
        type: 'text',
        text: text.trim(),
        x: point.x,
        y: point.y,
        fontSize: FONT_SIZE,
      }));
      return;
    }

    if (tool === 'pen') {
      setDraft({ type: 'pen', points: [point] });
      return;
    }

    setDraft({ type: tool, start: point, end: point });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;

    const point = toNormalizedPoint(event);

    if (draft.type === 'pen') {
      setDraft((prev) => {
        if (!prev || prev.type !== 'pen') return prev;
        return { ...prev, points: [...prev.points, point] };
      });
      return;
    }

    setDraft((prev) => {
      if (!prev || prev.type === 'pen') return prev;
      return { ...prev, end: point };
    });
  };

  const commitDraft = () => {
    if (!draft) return;

    if (draft.type === 'pen') {
      if (draft.points.length > 1) {
        addAnnotation((base) => ({
          ...base,
          type: 'pen',
          points: draft.points,
          thickness: PEN_THICKNESS,
        }));
      }

      setDraft(null);
      return;
    }

    const rect = normalizeRect(draft.start, draft.end);
    if (rect.width < 0.001 || rect.height < 0.001) {
      setDraft(null);
      return;
    }

    addAnnotation((base) => ({
      ...base,
      type: draft.type,
      ...rect,
      thickness: PEN_THICKNESS,
    }));

    setDraft(null);
  };

  const handlePointerUp = () => {
    commitDraft();
  };

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportSidecarClick = () => {
    sidecarInputRef.current?.click();
  };

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

    if (embedded) {
      loadedAnnotations = toAnnotationsByPage(embedded);
      setAuthor(embedded.exportedBy || 'local-user');
      loadedSource = embeddedAttachment ? 'embedded attachment' : 'legacy embedded metadata';
    } else if (local) {
      loadedAnnotations = toAnnotationsByPage(local);
      setAuthor(local.exportedBy || 'local-user');
      loadedSource = 'local autosave';
    }

    setPdfDoc(doc);
    setDocumentFingerprint(fingerprint);
    setSourceBytes(bytes);
    setFileName(name);
    setPageCount(doc.numPages);
    setPageNumber(1);
    setZoom(1);
    setAnnotationsByPage(loadedAnnotations);
    setDraft(null);
    setStatus(`Loaded ${name} (${doc.numPages} pages) with ${loadedSource}.`);
    setIsBusy(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await loadPdf(bytes, file.name);
    } catch (error) {
      setStatus(`Open error: ${(error as Error).message}`);
      setIsBusy(false);
    } finally {
      event.target.value = '';
    }
  };

  const handleSidecarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseAnnotationDocument(JSON.parse(text) as unknown);
      if (!parsed) {
        setStatus('Invalid sidecar file. Expected KPDF schema v2 JSON.');
        return;
      }

      setAnnotationsByPage(toAnnotationsByPage(parsed));
      setAuthor(parsed.exportedBy || 'local-user');

      if (parsed.sourceFingerprint && documentFingerprint && parsed.sourceFingerprint !== documentFingerprint) {
        setStatus('Imported sidecar with fingerprint mismatch. Verify markup alignment.');
      } else {
        setStatus(`Imported sidecar (${Object.keys(parsed.pages).length} pages).`);
      }
    } catch (error) {
      setStatus(`Import error: ${(error as Error).message}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setStatus('Drop a valid PDF file.');
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await loadPdf(bytes, file.name);
    } catch (error) {
      setStatus(`Drop error: ${(error as Error).message}`);
      setIsBusy(false);
    }
  };

  const downloadPdfFile = (output: Uint8Array, name: string) => {
    const blob = new Blob([output as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const savePdf = async () => {
    if (!sourceBytes) {
      setStatus('Open a PDF before saving.');
      return;
    }

    try {
      setIsBusy(true);
      setStatus(flattenOnSave ? 'Saving flattened PDF...' : 'Saving editable PDF...');

      const payload = createAnnotationDocument(
        annotationsByPage,
        author.trim() || 'local-user',
        documentFingerprint || undefined,
      );
      const serializedPayload = serializeAnnotationDocumentBytes(payload);
      const safeName = baseName(fileName);

      const output = await exportPdf(sourceBytes, annotationsByPage, {
        flatten: flattenOnSave,
        embeddedAttachment: flattenOnSave
          ? undefined
          : {
            fileName: PDF_ATTACHMENT_FILENAME,
            mimeType: PDF_ATTACHMENT_MIME,
            description: 'KPDF annotation payload v2',
            content: serializedPayload,
            thresholdBytes: DEFAULT_EMBED_SIZE_THRESHOLD_BYTES,
          },
      });

      downloadPdfFile(output.bytes, flattenOnSave ? `${safeName}-flattened.pdf` : `${safeName}-editable.pdf`);
      downloadSidecar(safeName, payload);

      if (documentFingerprint) {
        saveAnnotationsToLocalStorage(documentFingerprint, payload);
      }

      const buildSaveStatus = (persistence: ExportPersistenceResult): string => {
        if (flattenOnSave) {
          return 'Saved flattened PDF + sidecar JSON.';
        }
        if (persistence.mode === 'attachment') {
          return 'Saved editable PDF (embedded attachment) + sidecar JSON.';
        }
        if (persistence.mode === 'sidecar-only') {
          return `Saved editable PDF + sidecar JSON. Payload ${persistence.payloadBytes}B exceeded ${persistence.thresholdBytes}B embed threshold.`;
        }
        return 'Saved editable PDF + sidecar JSON.';
      };

      setStatus(buildSaveStatus(output.persistence));
      setIsBusy(false);
    } catch (error) {
      setStatus(`Save error: ${(error as Error).message}`);
      setIsBusy(false);
    }
  };

  const undo = () => {
    setAnnotationsByPage((prev) => {
      const page = prev[pageNumber] ?? [];
      if (page.length === 0) return prev;

      const nextPage = [...page];
      let removed = false;
      for (let i = nextPage.length - 1; i >= 0; i -= 1) {
        if (!nextPage[i].locked) {
          nextPage.splice(i, 1);
          removed = true;
          break;
        }
      }

      if (!removed) return prev;

      return {
        ...prev,
        [pageNumber]: nextPage,
      };
    });
  };

  const clearPage = () => {
    setAnnotationsByPage((prev) => ({
      ...prev,
      [pageNumber]: (prev[pageNumber] ?? []).filter((annotation) => annotation.locked),
    }));
  };

  return (
    <div className="app" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      <header className="toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          hidden
        />

        <input
          ref={sidecarInputRef}
          type="file"
          accept="application/json,.json,.kpdf.json"
          onChange={handleSidecarFileChange}
          hidden
        />

        <button onClick={handleOpenClick}>Open PDF</button>
        <button onClick={handleImportSidecarClick} disabled={!pdfDoc || isBusy}>Import Sidecar</button>
        <button onClick={savePdf} disabled={!pdfDoc || isBusy}>Save PDF</button>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={flattenOnSave}
            onChange={(event) => setFlattenOnSave(event.target.checked)}
            disabled={!pdfDoc || isBusy}
          />
          Flatten on save
        </label>

        <span className="divider" />

        {(['pen', 'rectangle', 'highlight', 'text'] as Tool[]).map((id) => (
          <button
            key={id}
            className={tool === id ? 'active' : ''}
            onClick={() => setTool(id)}
            disabled={!pdfDoc}
          >
            {toolLabels[id]}
          </button>
        ))}

        <input
          className="color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          disabled={!pdfDoc}
          title="Markup color"
        />

        <label className="author-row">
          Author
          <input
            className="author-input"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            disabled={!pdfDoc}
          />
        </label>

        <button onClick={undo} disabled={!pdfDoc}>Undo</button>
        <button onClick={clearPage} disabled={!pdfDoc}>Clear Page</button>

        <span className="divider" />

        <button onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.1).toFixed(2)))} disabled={!pdfDoc}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((value) => Math.min(3, +(value + 0.1).toFixed(2)))} disabled={!pdfDoc}>+</button>

        <span className="divider" />

        <button
          onClick={() => {
            setDraft(null);
            setPageNumber((value) => Math.max(1, value - 1));
          }}
          disabled={!pdfDoc || pageNumber <= 1}
        >
          Prev
        </button>

        <span>{pageNumber} / {pageCount || 0}</span>

        <button
          onClick={() => {
            setDraft(null);
            setPageNumber((value) => Math.min(pageCount, value + 1));
          }}
          disabled={!pdfDoc || pageNumber >= pageCount}
        >
          Next
        </button>
      </header>

      <main className="canvas-shell">
        {!pdfDoc ? (
          <div className="empty-state">
            <h1>KPDF Markup MVP</h1>
            <p>Open or drop a PDF to start marking up.</p>
          </div>
        ) : (
          <div className="page-wrap">
            <canvas ref={pdfCanvasRef} className="pdf-canvas" />
            <canvas
              ref={overlayCanvasRef}
              className="overlay-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        )}
      </main>

      <footer className="status-line">
        <span>{status}</span>
      </footer>
    </div>
  );
}
