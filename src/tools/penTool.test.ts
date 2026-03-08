import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import type { Action } from '../engine/actions';

import './penTool';
import { getTool } from './registry';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    dispatch: vi.fn(),
    page: 1,
    color: '#ff0000',
    author: 'tester',
    annotations: [],
    selection: { ids: new Set(), activeHandle: null, dragOrigin: null },
    draft: null,
    setDraft: vi.fn(),
    setSelection: vi.fn(),
    nextZIndex: () => 1,
    randomId: () => 'test-id',
    ...overrides,
  };
}

function makeEvent(x: number, y: number, shiftKey = false): NormalizedPointerEvent {
  return { point: { x, y }, shiftKey, ctrlKey: false, metaKey: false };
}

describe('penTool', () => {
  const tool = getTool('pen')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('pen');
  });

  it('creates a pen annotation on drag with multiple points', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, draft: null, setDraft });

    // Pointer down starts drawing
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    expect(setDraft).toHaveBeenCalled();

    // Pointer move adds points
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.2, 0.2));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.3, 0.3));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));

    // Pointer up commits annotation
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));
    expect(dispatch).toHaveBeenCalled();

    const action = dispatch.mock.calls[0][0] as Action;
    expect(action.type).toBe('ADD_ANNOTATION');
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.type).toBe('pen');
      if (action.annotation.type === 'pen') {
        expect(action.annotation.points.length).toBeGreaterThan(1);
        expect(action.annotation.thickness).toBe(0.0025);
        expect(action.annotation.strokeWidths).toBeDefined();
        expect(action.annotation.strokeWidths.length).toBe(action.annotation.points.length);
      }
    }
  });

  it('does not create annotation for single point (no move)', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('sets draft to null after committing', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.3, 0.3));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.3, 0.3));

    // Last setDraft call should be null (cleanup)
    const lastCall = setDraft.mock.calls[setDraft.mock.calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });

  it('accumulates points during move', () => {
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));

    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.15, 0.15));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.2, 0.2));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.25, 0.25));

    // Draft should have accumulated points
    const d = draft as { toolType: string; points: { x: number; y: number }[] };
    expect(d.toolType).toBe('pen');
    expect(d.points.length).toBe(4); // 1 initial + 3 moves
  });

  it('uses context color and author', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft, color: '#00ff00', author: 'jane' });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.3, 0.3));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.3, 0.3));

    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.color).toBe('#00ff00');
      expect(action.annotation.author).toBe('jane');
    }
  });

  it('ignores pointerMove when no draft is active', () => {
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ setDraft });

    // Move without a preceding pointerDown
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    // setDraft is called but draft stays null since updater returns prev for non-pen draft
    expect(draft).toBeNull();
  });
});
