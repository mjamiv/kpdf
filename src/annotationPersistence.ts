import type { Annotation, AnnotationDocumentV2, AnnotationsByPage, ArrowAnnotation, CalloutAnnotation, CloudAnnotation, MeasurementAnnotation, PolygonAnnotation, StampAnnotation } from './types';

export const SCHEMA_VERSION = 2;
export const PDF_METADATA_PREFIX = 'KPDF_ANN_V2:';
export const PDF_ATTACHMENT_FILENAME = 'kpdf-annotations-v2.json';
export const PDF_ATTACHMENT_MIME = 'application/vnd.kpdf.annotations+json';
export const DEFAULT_EMBED_SIZE_THRESHOLD_BYTES = 300_000;
const STORAGE_PREFIX = 'kpdf.annotations.v2';

function encodeUtf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizePages(annotationsByPage: AnnotationsByPage): Record<string, Annotation[]> {
  const entries = Object.entries(annotationsByPage).map(([pageKey, annotations]) => [
    String(Number(pageKey)),
    [...annotations].sort((a, b) => a.zIndex - b.zIndex),
  ]);

  return Object.fromEntries(entries);
}

function denormalizePages(pages: Record<string, Annotation[]>): AnnotationsByPage {
  const pairs = Object.entries(pages)
    .map(([pageKey, annotations]) => [Number(pageKey), annotations] as const)
    .filter(([pageKey]) => Number.isFinite(pageKey) && pageKey > 0);

  return Object.fromEntries(pairs);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && typeof point.y === 'number';
}

function isAnnotation(value: unknown): value is Annotation {
  if (!value || typeof value !== 'object') return false;
  const annotation = value as Partial<Annotation>;

  if (typeof annotation.id !== 'string') return false;
  if (typeof annotation.zIndex !== 'number') return false;
  if (typeof annotation.color !== 'string') return false;
  if (typeof annotation.author !== 'string') return false;
  if (!isIsoDate(annotation.createdAt) || !isIsoDate(annotation.updatedAt)) return false;
  if (typeof annotation.locked !== 'boolean') return false;

  if (annotation.type === 'pen') {
    return Array.isArray(annotation.points)
      && annotation.points.every(isPoint)
      && typeof annotation.thickness === 'number';
  }

  if (annotation.type === 'rectangle' || annotation.type === 'highlight') {
    return [annotation.x, annotation.y, annotation.width, annotation.height, annotation.thickness]
      .every((field) => typeof field === 'number');
  }

  if (annotation.type === 'text') {
    return [annotation.x, annotation.y, annotation.fontSize]
      .every((field) => typeof field === 'number') && typeof annotation.text === 'string';
  }

  if (annotation.type === 'arrow') {
    const a = annotation as Partial<ArrowAnnotation>;
    return isPoint(a.start) && isPoint(a.end)
      && typeof a.thickness === 'number' && typeof a.headSize === 'number';
  }

  if (annotation.type === 'callout') {
    const a = annotation as Partial<CalloutAnnotation>;
    return a.box !== null && typeof a.box === 'object'
      && typeof (a.box as Record<string, unknown>).x === 'number'
      && typeof (a.box as Record<string, unknown>).y === 'number'
      && typeof (a.box as Record<string, unknown>).width === 'number'
      && typeof (a.box as Record<string, unknown>).height === 'number'
      && isPoint(a.leaderTarget) && typeof a.text === 'string' && typeof a.fontSize === 'number';
  }

  if (annotation.type === 'cloud') {
    const a = annotation as Partial<CloudAnnotation>;
    return [a.x, a.y, a.width, a.height].every((f) => typeof f === 'number');
  }

  if (annotation.type === 'measurement') {
    const a = annotation as Partial<MeasurementAnnotation>;
    return isPoint(a.start) && isPoint(a.end)
      && typeof a.thickness === 'number' && typeof a.scale === 'number' && typeof a.unit === 'string';
  }

  if (annotation.type === 'polygon') {
    const a = annotation as Partial<PolygonAnnotation>;
    return Array.isArray(a.points) && a.points.every(isPoint)
      && typeof a.closed === 'boolean' && typeof a.thickness === 'number';
  }

  if (annotation.type === 'stamp') {
    const a = annotation as Partial<StampAnnotation>;
    return [a.x, a.y, a.width, a.height].every((f) => typeof f === 'number')
      && typeof a.stampId === 'string' && typeof a.label === 'string';
  }

  return false;
}

export function createAnnotationDocument(
  annotationsByPage: AnnotationsByPage,
  author: string,
  sourceFingerprint?: string,
): AnnotationDocumentV2 {
  return {
    schemaVersion: SCHEMA_VERSION,
    sourceFingerprint,
    exportedAt: new Date().toISOString(),
    exportedBy: author,
    pages: normalizePages(annotationsByPage),
  };
}

export function parseAnnotationDocument(input: unknown): AnnotationDocumentV2 | null {
  if (!input || typeof input !== 'object') return null;
  const doc = input as Partial<AnnotationDocumentV2>;

  if (doc.schemaVersion !== SCHEMA_VERSION) return null;
  if (!isIsoDate(doc.exportedAt)) return null;
  if (typeof doc.exportedBy !== 'string') return null;
  if (!doc.pages || typeof doc.pages !== 'object') return null;

  const parsedPages: Record<string, Annotation[]> = {};

  for (const [pageKey, annotations] of Object.entries(doc.pages)) {
    if (!Array.isArray(annotations)) return null;
    const valid = annotations.filter(isAnnotation);
    parsedPages[pageKey] = valid.sort((a, b) => a.zIndex - b.zIndex);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    sourceFingerprint: doc.sourceFingerprint,
    exportedAt: doc.exportedAt,
    exportedBy: doc.exportedBy,
    pages: parsedPages,
  };
}

export function serializeAnnotationDocument(doc: AnnotationDocumentV2): string {
  return JSON.stringify(doc, null, 2);
}

export function serializeAnnotationDocumentBytes(doc: AnnotationDocumentV2): Uint8Array {
  return encodeUtf8(serializeAnnotationDocument(doc));
}

export function parseAnnotationDocumentFromBytes(bytes: Uint8Array): AnnotationDocumentV2 | null {
  try {
    return parseAnnotationDocument(JSON.parse(decodeUtf8(bytes)) as unknown);
  } catch {
    return null;
  }
}

export function shouldEmbedPayload(
  payloadSizeBytes: number,
  thresholdBytes = DEFAULT_EMBED_SIZE_THRESHOLD_BYTES,
): boolean {
  return payloadSizeBytes <= thresholdBytes;
}

export function encodeMetadataKeyword(doc: AnnotationDocumentV2): string {
  const json = serializeAnnotationDocument(doc);
  const encoded = encodeBase64(encodeUtf8(json));
  return `${PDF_METADATA_PREFIX}${encoded}`;
}

export function decodeMetadataKeyword(keyword: string): AnnotationDocumentV2 | null {
  if (!keyword.startsWith(PDF_METADATA_PREFIX)) return null;

  try {
    const encoded = keyword.slice(PDF_METADATA_PREFIX.length);
    const json = decodeUtf8(decodeBase64(encoded));
    const parsed = JSON.parse(json) as unknown;
    return parseAnnotationDocument(parsed);
  } catch {
    return null;
  }
}

export function extractDocumentFromKeywords(keywords: string | undefined): AnnotationDocumentV2 | null {
  if (!keywords) return null;

  const keywordList = keywords
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const keyword of keywordList) {
    const doc = decodeMetadataKeyword(keyword);
    if (doc) return doc;
  }

  return null;
}

export function extractDocumentFromAttachments(attachments: unknown): AnnotationDocumentV2 | null {
  if (!attachments || typeof attachments !== 'object') return null;

  const records = Object.values(attachments as Record<string, unknown>);

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;

    const attachment = record as {
      filename?: unknown;
      content?: unknown;
      mimeType?: unknown;
    };

    const fileName = typeof attachment.filename === 'string' ? attachment.filename : '';
    const isTargetFile = fileName === PDF_ATTACHMENT_FILENAME || fileName.endsWith('.kpdf.json');
    if (!isTargetFile) continue;

    if (attachment.content instanceof Uint8Array) {
      const parsed = parseAnnotationDocumentFromBytes(attachment.content);
      if (parsed) return parsed;
    }
  }

  return null;
}

export function toAnnotationsByPage(doc: AnnotationDocumentV2): AnnotationsByPage {
  return denormalizePages(doc.pages);
}

export function makeStorageKey(fingerprint: string): string {
  return `${STORAGE_PREFIX}:${fingerprint}`;
}

export function saveAnnotationsToLocalStorage(fingerprint: string, doc: AnnotationDocumentV2): void {
  localStorage.setItem(makeStorageKey(fingerprint), serializeAnnotationDocument(doc));
}

export function loadAnnotationsFromLocalStorage(fingerprint: string): AnnotationDocumentV2 | null {
  const raw = localStorage.getItem(makeStorageKey(fingerprint));
  if (!raw) return null;

  try {
    return parseAnnotationDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function downloadSidecar(baseName: string, doc: AnnotationDocumentV2): void {
  const blob = new Blob([serializeAnnotationDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${baseName}.kpdf.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
