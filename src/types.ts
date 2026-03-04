export type Tool = 'pen' | 'rectangle' | 'highlight' | 'text' | 'select' | 'arrow' | 'callout' | 'cloud' | 'measurement' | 'polygon' | 'stamp';

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
  rotation?: number;
  comment?: string;
  status?: 'open' | 'resolved' | 'rejected';
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

export type ArrowAnnotation = BaseAnnotation & {
  type: 'arrow';
  start: Point;
  end: Point;
  thickness: number;
  headSize: number;
};

export type CalloutAnnotation = BaseAnnotation & {
  type: 'callout';
  box: { x: number; y: number; width: number; height: number };
  leaderTarget: Point;
  text: string;
  fontSize: number;
};

export type CloudAnnotation = BaseAnnotation & {
  type: 'cloud';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MeasurementAnnotation = BaseAnnotation & {
  type: 'measurement';
  start: Point;
  end: Point;
  thickness: number;
  scale: number;
  unit: string;
};

export type PolygonAnnotation = BaseAnnotation & {
  type: 'polygon';
  points: Point[];
  closed: boolean;
  thickness: number;
};

export type StampAnnotation = BaseAnnotation & {
  type: 'stamp';
  x: number;
  y: number;
  width: number;
  height: number;
  stampId: string;
  label: string;
};

export type Annotation =
  | PenAnnotation
  | RectAnnotation
  | TextAnnotation
  | ArrowAnnotation
  | CalloutAnnotation
  | CloudAnnotation
  | MeasurementAnnotation
  | PolygonAnnotation
  | StampAnnotation;

export type AnchorPosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type AnnotationDocumentV2 = {
  schemaVersion: 2;
  sourceFingerprint?: string;
  exportedAt: string;
  exportedBy: string;
  pages: Record<string, Annotation[]>;
};

export type AnnotationsByPage = Record<number, Annotation[]>;
