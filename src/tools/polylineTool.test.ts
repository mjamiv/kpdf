import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import type { Action } from '../engine/actions';

import './polylineTool';
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

function makeEvent(x: number, y: number): NormalizedPointerEvent {
  return { point: { x, y }, shiftKey: false, ctrlKey: false, metaKey: false };
}

describe('polylineTool', () => {
  const tool = getTool('polyline')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('polyline');
  });

  it('creates polyline annotation on Enter after multiple clicks', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    // First click starts polyline
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    expect(setDraft).toHaveBeenCalled();

    // Second click adds a point
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.3, 0.2));

    // Third click adds another point
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.1));

    // Press Enter to finalize
    tool.onKeyDown!({ ...ctx, get draft() { return draft; } }, { key: 'Enter' } as KeyboardEvent);

    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0] as Action;
    expect(action.type).toBe('ADD_ANNOTATION');
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.annotation.type).toBe('polyline');
      if (action.annotation.type === 'polyline') {
        expect(action.annotation.points).toHaveLength(3);
      }
    }
  });

  it('cancels polyline on Escape', () => {
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch: vi.fn(), setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onKeyDown!({ ...ctx, get draft() { return draft; } }, { key: 'Escape' } as KeyboardEvent);
    expect(draft).toBeNull();
  });

  it('does not commit with only one point', () => {
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ dispatch, setDraft });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onKeyDown!({ ...ctx, get draft() { return draft; } }, { key: 'Enter' } as KeyboardEvent);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
