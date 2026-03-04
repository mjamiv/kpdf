import { describe, expect, it } from 'vitest';
import {
  createAnnotationDocument,
  decodeMetadataKeyword,
  encodeMetadataKeyword,
  extractDocumentFromAttachments,
  extractDocumentFromKeywords,
  parseAnnotationDocument,
  serializeAnnotationDocumentBytes,
  shouldEmbedPayload,
  toAnnotationsByPage,
} from './annotationPersistence';
import type { Annotation } from './types';

const sampleAnnotation: Annotation = {
  id: 'a1',
  zIndex: 1,
  type: 'text',
  x: 0.2,
  y: 0.3,
  text: 'RFI 12',
  fontSize: 0.02,
  color: '#111111',
  author: 'engineer',
  createdAt: '2026-03-04T12:00:00.000Z',
  updatedAt: '2026-03-04T12:00:00.000Z',
  locked: false,
};

describe('annotation persistence v2', () => {
  it('roundtrips metadata keyword payload for backward compatibility', () => {
    const doc = createAnnotationDocument({ 1: [sampleAnnotation] }, 'engineer', 'fp1');
    const keyword = encodeMetadataKeyword(doc);
    const parsed = decodeMetadataKeyword(keyword);

    expect(parsed?.schemaVersion).toBe(2);
    expect(parsed?.sourceFingerprint).toBe('fp1');
    expect(parsed?.pages['1'][0].id).toBe('a1');
  });

  it('extracts payload from attachments', () => {
    const doc = createAnnotationDocument({ 1: [sampleAnnotation] }, 'engineer', 'fp2');
    const content = serializeAnnotationDocumentBytes(doc);

    const found = extractDocumentFromAttachments({
      'kpdf-annotations-v2.json': {
        filename: 'kpdf-annotations-v2.json',
        content,
      },
    });

    expect(found?.sourceFingerprint).toBe('fp2');
  });

  it('extracts payload from PDF keywords field', () => {
    const doc = createAnnotationDocument({ 1: [sampleAnnotation] }, 'engineer', 'fp3');
    const keyword = encodeMetadataKeyword(doc);
    const found = extractDocumentFromKeywords(`foo, ${keyword}, bar`);

    expect(found?.sourceFingerprint).toBe('fp3');
  });

  it('rejects invalid documents', () => {
    const invalid = parseAnnotationDocument({ schemaVersion: 1 });
    expect(invalid).toBeNull();
  });

  it('restores numeric page map', () => {
    const doc = createAnnotationDocument({ 2: [sampleAnnotation] }, 'engineer');
    const pageMap = toAnnotationsByPage(doc);
    expect(pageMap[2][0].id).toBe('a1');
  });

  it('applies embedding threshold logic', () => {
    expect(shouldEmbedPayload(120_000, 300_000)).toBe(true);
    expect(shouldEmbedPayload(320_000, 300_000)).toBe(false);
  });
});
