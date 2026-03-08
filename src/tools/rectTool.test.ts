import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import type { Action } from '../engine/actions';

import './rectTool';
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

describe('rectTool', () => {
  const tool = getTool('rectangle')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('rectangle');
  });

  it('creates a rectangle annotation on drag', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, draft: null, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.2));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.6));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.6));

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    expect(action.type).toBe('ADD_ANNOTATION');
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.type).toBe('rectangle');
      if (action.annotation.type === 'rectangle') {
        expect(action.annotation.x).toBeCloseTo(0.1, 5);
        expect(action.annotation.y).toBeCloseTo(0.2, 5);
        expect(action.annotation.width).toBeCloseTo(0.4, 5);
        expect(action.annotation.height).toBeCloseTo(0.4, 5);
      }
    }
  });

  it('does not create annotation for tiny drag', () => {
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

  it('normalizes rectangle when dragging up-left', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    // Start bottom-right, drag to top-left
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.6, 0.7));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.2, 0.3));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.2, 0.3));

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION' && action.annotation.type === 'rectangle') {
      // Normalized: x/y should be the top-left corner
      expect(action.annotation.x).toBeCloseTo(0.2, 5);
      expect(action.annotation.y).toBeCloseTo(0.3, 5);
      expect(action.annotation.width).toBeCloseTo(0.4, 5);
      expect(action.annotation.height).toBeCloseTo(0.4, 5);
    }
  });

  it('updates draft end on pointer move', () => {
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.5));

    const d = draft as { toolType: string; start: { x: number; y: number }; end: { x: number; y: number } };
    expect(d.toolType).toBe('rectangle');
    expect(d.end.x).toBeCloseTo(0.4, 5);
    expect(d.end.y).toBeCloseTo(0.5, 5);
  });

  it('sets draft to null after committing', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));

    expect(draft).toBeNull();
  });

  it('uses context color and author', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft, color: '#0000ff', author: 'bob' });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));

    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.color).toBe('#0000ff');
      expect(action.annotation.author).toBe('bob');
    }
  });
});

describe('highlightTool', () => {
  const tool = getTool('highlight')!;

  it('is registered as highlight', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('highlight');
  });

  it('creates a highlight annotation on drag', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.3));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.3));

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.type).toBe('highlight');
    }
  });
});
