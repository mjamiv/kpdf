import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import type { Action } from '../engine/actions';

// Import the tool to register it, then get it from the registry
import './ellipseTool';
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

describe('ellipseTool', () => {
  const tool = getTool('ellipse')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('ellipse');
  });

  it('creates an ellipse annotation on drag', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, draft: null, setDraft });

    // Pointer down
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    expect(setDraft).toHaveBeenCalled();

    // Pointer move
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.3));

    // Pointer up
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.3));
    expect(dispatch).toHaveBeenCalled();

    const action = dispatch.mock.calls[0][0] as Action;
    expect(action.type).toBe('ADD_ANNOTATION');
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.type).toBe('ellipse');
      if (action.annotation.type === 'ellipse') {
        expect(action.annotation.width).toBeCloseTo(0.3, 5);
        expect(action.annotation.height).toBeCloseTo(0.2, 5);
      }
    }
  });

  it('constrains to circle when shift is held', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.2, 0.2));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.35, true));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.35, true));

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION' && action.annotation.type === 'ellipse') {
      expect(action.annotation.width).toBeCloseTo(action.annotation.height, 5);
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
});
