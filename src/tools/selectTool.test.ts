import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import type { Annotation } from '../types';

import './selectTool';
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

function makeRectAnnotation(id: string, x: number, y: number, w: number, h: number): Annotation {
  return {
    id,
    type: 'rectangle',
    x, y,
    width: w,
    height: h,
    color: '#ff0000',
    author: 'tester',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    zIndex: 1,
    locked: false,
    thickness: 0.0025,
  };
}

describe('selectTool', () => {
  const tool = getTool('select')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('select');
  });

  it('selects an annotation on click', () => {
    const ann = makeRectAnnotation('ann-1', 0.3, 0.3, 0.2, 0.2);
    const setSelection = vi.fn();
    const ctx = makeCtx({ annotations: [ann], setSelection });

    // Click inside the annotation
    tool.onPointerDown(ctx, makeEvent(0.4, 0.4));
    expect(setSelection).toHaveBeenCalled();
  });

  it('deselects all when clicking empty area', () => {
    const setSelection = vi.fn();
    const ctx = makeCtx({ setSelection, annotations: [] });

    tool.onPointerDown(ctx, makeEvent(0.5, 0.5));
    expect(setSelection).toHaveBeenCalledWith(
      expect.objectContaining({ ids: expect.any(Set) }),
    );
    // Should result in empty selection
    const sel = setSelection.mock.calls[0][0];
    expect(sel.ids.size).toBe(0);
  });

  it('starts marquee selection when clicking empty area', () => {
    const setDraft = vi.fn();
    const ctx = makeCtx({ setDraft, annotations: [] });

    tool.onPointerDown(ctx, makeEvent(0.1, 0.1));
    expect(setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ toolType: 'marquee', origin: { x: 0.1, y: 0.1 } }),
    );
  });

  it('dispatches MOVE_ANNOTATION on drag of selected annotation', () => {
    const ann = makeRectAnnotation('ann-1', 0.3, 0.3, 0.2, 0.2);
    const dispatch = vi.fn();
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const selection = { ids: new Set(['ann-1']), activeHandle: null, dragOrigin: null };
    const ctx = makeCtx({ dispatch, annotations: [ann], selection, setDraft });

    // Click on annotation to start drag
    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.4, 0.4));

    // Move to drag
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.45, 0.45));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));

    // Release
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    expect(dispatch).toHaveBeenCalled();

    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe('MOVE_ANNOTATION');
    expect(action.id).toBe('ann-1');
  });

  it('does not move locked annotations', () => {
    const ann = makeRectAnnotation('ann-1', 0.3, 0.3, 0.2, 0.2);
    ann.locked = true;
    const setDraft = vi.fn();
    const ctx = makeCtx({ annotations: [ann], setDraft });

    tool.onPointerDown(ctx, makeEvent(0.4, 0.4));
    // setDraft should not have been called with a select draft
    expect(setDraft).not.toHaveBeenCalled();
  });

  it('clears draft on pointer up from marquee', () => {
    let draft: unknown = null;
    const setDraft = vi.fn((v: unknown) => {
      draft = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draft) : v;
    });
    const ctx = makeCtx({ setDraft, annotations: [] });

    tool.onPointerDown({ ...ctx, get draft() { return draft; } }, makeEvent(0.1, 0.1));
    tool.onPointerMove({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));
    tool.onPointerUp({ ...ctx, get draft() { return draft; } }, makeEvent(0.5, 0.5));

    expect(draft).toBeNull();
  });

  it('toggles selection with shift+click', () => {
    const ann = makeRectAnnotation('ann-1', 0.3, 0.3, 0.2, 0.2);
    const setSelection = vi.fn();
    const ctx = makeCtx({ annotations: [ann], setSelection });

    tool.onPointerDown(ctx, makeEvent(0.4, 0.4, true));
    expect(setSelection).toHaveBeenCalled();
  });
});
