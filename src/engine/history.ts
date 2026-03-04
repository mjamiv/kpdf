import type { Action } from './actions';

export type UndoEntry = {
  forward: Action;
  inverse: Action;
  timestamp: number;
  coalesceKey?: string;
};

export type UndoStack = {
  push(entry: UndoEntry): void;
  undo(): Action | null;
  redo(): Action | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  readonly undoDepth: number;
  readonly redoDepth: number;
};

const MAX_UNDO = 200;
const COALESCE_MS = 300;

export function createUndoStack(): UndoStack {
  const undoStack: UndoEntry[] = [];
  const redoStack: UndoEntry[] = [];

  return {
    push(entry: UndoEntry): void {
      const top = undoStack[undoStack.length - 1];
      if (
        top &&
        entry.coalesceKey &&
        top.coalesceKey === entry.coalesceKey &&
        entry.timestamp - top.timestamp <= COALESCE_MS
      ) {
        top.forward = entry.forward;
        top.timestamp = entry.timestamp;
      } else {
        undoStack.push(entry);
        if (undoStack.length > MAX_UNDO) {
          undoStack.shift();
        }
      }
      redoStack.length = 0;
    },

    undo(): Action | null {
      const entry = undoStack.pop();
      if (!entry) return null;
      redoStack.push(entry);
      return entry.inverse;
    },

    redo(): Action | null {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push(entry);
      return entry.forward;
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    clear(): void {
      undoStack.length = 0;
      redoStack.length = 0;
    },

    get undoDepth(): number {
      return undoStack.length;
    },

    get redoDepth(): number {
      return redoStack.length;
    },
  };
}
