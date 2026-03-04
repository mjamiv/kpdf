import type { Annotation, AnchorPosition } from '../types';

export type Action =
  | { type: 'ADD_ANNOTATION'; page: number; annotation: Annotation }
  | { type: 'REMOVE_ANNOTATION'; page: number; id: string; removed?: Annotation }
  | { type: 'UPDATE_ANNOTATION'; page: number; id: string; patch: Partial<Annotation>; previous?: Partial<Annotation> }
  | { type: 'MOVE_ANNOTATION'; page: number; id: string; dx: number; dy: number }
  | { type: 'RESIZE_ANNOTATION'; page: number; id: string; anchor: AnchorPosition; dx: number; dy: number }
  | { type: 'ROTATE_ANNOTATION'; page: number; id: string; angle: number; previousAngle?: number }
  | { type: 'SET_Z_ORDER'; page: number; id: string; op: 'front' | 'back' | 'up' | 'down'; previousZIndex?: number; newZIndex?: number }
  | { type: 'LOCK_ANNOTATION'; page: number; id: string; locked: boolean }
  | { type: 'BATCH'; actions: Action[] }
  | { type: 'LOAD_PAGE'; page: number; annotations: Annotation[] }
  | { type: 'CLEAR_PAGE'; page: number; removed?: Annotation[] };
