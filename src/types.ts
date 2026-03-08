export type Tool = 'pen' | 'rectangle' | 'highlight' | 'text' | 'select' | 'arrow' | 'callout' | 'cloud' | 'measurement' | 'polygon' | 'stamp' | 'area' | 'angle' | 'count' | 'dimension' | 'ellipse' | 'polyline' | 'hyperlink';

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
  strokeWidths?: number[];
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
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
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
  knee: Point;
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
  imageUrl?: string;
};

export type EllipseAnnotation = BaseAnnotation & {
  type: 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
};

export type AreaAnnotation = BaseAnnotation & {
  type: 'area';
  points: Point[];
  thickness: number;
  scale: number;
  unit: string;
};

export type AngleAnnotation = BaseAnnotation & {
  type: 'angle';
  vertex: Point;
  ray1: Point;
  ray2: Point;
  thickness: number;
};

export type CountAnnotation = BaseAnnotation & {
  type: 'count';
  x: number;
  y: number;
  number: number;
  groupId: string;
  radius: number;
};

export type DimensionAnnotation = BaseAnnotation & {
  type: 'dimension';
  start: Point;
  end: Point;
  offset: number;
  thickness: number;
  scale: number;
  unit: string;
};

export type PolylineAnnotation = BaseAnnotation & {
  type: 'polyline';
  points: Point[];
  thickness: number;
};

export type HyperlinkAnnotation = BaseAnnotation & {
  type: 'hyperlink';
  x: number;
  y: number;
  width: number;
  height: number;
  targetPage: number;
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
  | StampAnnotation
  | EllipseAnnotation
  | AreaAnnotation
  | AngleAnnotation
  | CountAnnotation
  | DimensionAnnotation
  | PolylineAnnotation
  | HyperlinkAnnotation;

export type AnchorPosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type PageScale = {
  pixelDistance: number;
  realDistance: number;
  unit: string;
};

export type AnnotationDocumentV2 = {
  schemaVersion: 2;
  sourceFingerprint?: string;
  exportedAt: string;
  exportedBy: string;
  pages: Record<string, Annotation[]>;
  pageScales?: Record<string, PageScale>;
};

export type AnnotationsByPage = Record<number, Annotation[]>;
