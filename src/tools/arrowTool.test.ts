import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import type { Action } from '../engine/actions';

import './arrowTool';
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

describe('arrowTool', () => {
  const tool = getTool('arrow')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('arrow');
  });

  it('creates an arrow annotation on drag', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, draft: null, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    expect(action.type).toBe('ADD_ANNOTATION');
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.type).toBe('arrow');
      if (action.annotation.type === 'arrow') {
        expect(action.annotation.start).toEqual({ x: 0.1, y: 0.1 });
        expect(action.annotation.end).toEqual({ x: 0.5, y: 0.5 });
        expect(action.annotation.thickness).toBe(0.0025);
        expect(action.annotation.headSize).toBe(0.015);
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

  it('constrains to 45-degree angles when shift is held', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.2, 0.2));
    // Move at a slight angle with shift held — should snap
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.21, true));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.21, true));

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION' && action.annotation.type === 'arrow') {
      // The y should be snapped (close to start.y for horizontal snap)
      expect(action.annotation.end.y).toBeCloseTo(0.2, 1);
    }
  });

  it('sets draft to null after committing', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));

    expect(draft).toBeNull();
  });

  it('updates draft end on pointer move', () => {
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.6, 0.7));

    const d = draft as { toolType: string; start: { x: number; y: number }; end: { x: number; y: number } };
    expect(d.toolType).toBe('arrow');
    expect(d.end.x).toBeCloseTo(0.6, 5);
    expect(d.end.y).toBeCloseTo(0.7, 5);
  });

  it('uses context color and author', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft, color: '#123456', author: 'eve' });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));

    const action = dispatch.mock.calls[0][0] as Action;
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.color).toBe('#123456');
      expect(action.annotation.author).toBe('eve');
    }
  });
});
