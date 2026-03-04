import { describe, it, expect } from 'vitest';
import { createUndoStack, type UndoEntry } from './history';
import type { Action } from './actions';

function makeEntry(id: number, opts?: { coalesceKey?: string; timestamp?: number }): UndoEntry {
  const forward: Action = {
    type: 'MOVE_ANNOTATION',
    page: 0,
    id: `ann-${id}`,
    dx: id,
    dy: id,
  };
  const inverse: Action = {
    type: 'MOVE_ANNOTATION',
    page: 0,
    id: `ann-${id}`,
    dx: -id,
    dy: -id,
  };
  return {
    forward,
    inverse,
    timestamp: opts?.timestamp ?? Date.now(),
    coalesceKey: opts?.coalesceKey,
  };
}

describe('UndoStack', () => {
  it('push 5, undo 3, redo 2 - verify depths at each step', () => {
    const stack = createUndoStack();
    for (let i = 1; i <= 5; i++) {
      stack.push(makeEntry(i));
    }
    expect(stack.undoDepth).toBe(5);
    expect(stack.redoDepth).toBe(0);

    stack.undo();
    stack.undo();
    stack.undo();
    expect(stack.undoDepth).toBe(2);
    expect(stack.redoDepth).toBe(3);

    stack.redo();
    stack.redo();
    expect(stack.undoDepth).toBe(4);
    expect(stack.redoDepth).toBe(1);
  });

  it('coalescing: 3 entries with same key within 300ms produce 1 undo entry', () => {
    const stack = createUndoStack();
    const t = 1000;
    stack.push(makeEntry(1, { coalesceKey: 'drag', timestamp: t }));
    stack.push(makeEntry(2, { coalesceKey: 'drag', timestamp: t + 100 }));
    stack.push(makeEntry(3, { coalesceKey: 'drag', timestamp: t + 200 }));
    expect(stack.undoDepth).toBe(1);
  });

  it('coalescing keeps original inverse and updates forward to latest', () => {
    const stack = createUndoStack();
    const t = 1000;
    const entry1 = makeEntry(1, { coalesceKey: 'drag', timestamp: t });
    const entry3 = makeEntry(3, { coalesceKey: 'drag', timestamp: t + 200 });
    stack.push(entry1);
    stack.push(makeEntry(2, { coalesceKey: 'drag', timestamp: t + 100 }));
    stack.push(entry3);

    const inverse = stack.undo();
    expect(inverse).toEqual(entry1.inverse);
  });

  it('coalescing timeout: same key but >300ms apart produces 2 entries', () => {
    const stack = createUndoStack();
    const t = 1000;
    stack.push(makeEntry(1, { coalesceKey: 'drag', timestamp: t }));
    stack.push(makeEntry(2, { coalesceKey: 'drag', timestamp: t + 301 }));
    expect(stack.undoDepth).toBe(2);
  });

  it('depth limit: push 201 entries, verify undo depth is 200', () => {
    const stack = createUndoStack();
    for (let i = 0; i < 201; i++) {
      stack.push(makeEntry(i));
    }
    expect(stack.undoDepth).toBe(200);
  });

  it('push after undo clears redo stack', () => {
    const stack = createUndoStack();
    stack.push(makeEntry(1));
    stack.push(makeEntry(2));
    stack.undo();
    expect(stack.redoDepth).toBe(1);

    stack.push(makeEntry(3));
    expect(stack.redoDepth).toBe(0);
  });

  it('empty stack: undo() and redo() return null', () => {
    const stack = createUndoStack();
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBeNull();
  });

  it('canUndo/canRedo reflect stack state', () => {
    const stack = createUndoStack();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);

    stack.push(makeEntry(1));
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);

    stack.undo();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);
  });

  it('clear() empties both stacks', () => {
    const stack = createUndoStack();
    stack.push(makeEntry(1));
    stack.push(makeEntry(2));
    stack.undo();
    expect(stack.undoDepth).toBe(1);
    expect(stack.redoDepth).toBe(1);

    stack.clear();
    expect(stack.undoDepth).toBe(0);
    expect(stack.redoDepth).toBe(0);
  });

  it('undo returns the correct inverse action', () => {
    const stack = createUndoStack();
    const entry = makeEntry(42);
    stack.push(entry);
    const result = stack.undo();
    expect(result).toEqual(entry.inverse);
  });

  it('redo returns the correct forward action', () => {
    const stack = createUndoStack();
    const entry = makeEntry(42);
    stack.push(entry);
    stack.undo();
    const result = stack.redo();
    expect(result).toEqual(entry.forward);
  });
});
