export type Tool = 'pen' | 'rectangle' | 'highlight' | 'text';

export type Point = {
  x: number;
  y: number;
};

export type BaseAnnotation = {
  id: string;
  zIndex: number;
  color: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  locked: boolean;
};

export type PenAnnotation = BaseAnnotation & {
  type: 'pen';
  points: Point[];
  thickness: number;
};

export type RectAnnotation = BaseAnnotation & {
  type: 'rectangle' | 'highlight';
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
};

export type TextAnnotation = BaseAnnotation & {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

export type Annotation = PenAnnotation | RectAnnotation | TextAnnotation;

export type AnnotationDocumentV2 = {
  schemaVersion: 2;
  sourceFingerprint?: string;
  exportedAt: string;
  exportedBy: string;
  pages: Record<string, Annotation[]>;
};

export type AnnotationsByPage = Record<number, Annotation[]>;
