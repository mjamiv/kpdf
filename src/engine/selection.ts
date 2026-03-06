import type { Annotation, Point, AnchorPosition } from '../types';

export type SelectionState = {
  ids: Set<string>;
  activeHandle: AnchorPosition | 'rotate' | null;
  dragOrigin: Point | null;
};

export function createSelectionState(): SelectionState {
  return { ids: new Set(), activeHandle: null, dragOrigin: null };
}

export function selectAnnotation(state: SelectionState, id: string, annotations: Annotation[]): SelectionState {
  const ann = annotations.find(a => a.id === id);
  if (!ann || ann.locked) return state;
  return { ...state, ids: new Set([id]) };
}

export function toggleAnnotation(state: SelectionState, id: string, annotations: Annotation[]): SelectionState {
  const ann = annotations.find(a => a.id === id);
  if (!ann || ann.locked) return state;
  const ids = new Set(state.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ...state, ids };
}

export function selectMultiple(state: SelectionState, ids: string[], annotations: Annotation[]): SelectionState {
  const validIds = ids.filter((id) => {
    const ann = annotations.find((a) => a.id === id);
    return ann && !ann.locked;
  });
  if (validIds.length === 0) return state;
  return { ...state, ids: new Set(validIds) };
}

export function selectAll(annotations: Annotation[]): SelectionState {
  const ids = annotations.filter((a) => !a.locked).map((a) => a.id);
  return { ids: new Set(ids), activeHandle: null, dragOrigin: null };
}

export function deselectAll(): SelectionState {
  return createSelectionState();
}
