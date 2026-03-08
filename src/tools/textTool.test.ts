import { describe, it, expect, vi } from 'vitest';
import type { ToolContext, NormalizedPointerEvent } from './registry';

import './textTool';
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

describe('textTool', () => {
  const tool = getTool('text')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('text');
  });

  it('sets draft with click position on pointer down', () => {
    const setDraft = vi.fn();
    const ctx = makeCtx({ setDraft, color: '#00ff00', author: 'alice' });

    tool.onPointerDown(ctx, makeEvent(0.3, 0.4));

    expect(setDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        toolType: 'text',
        x: 0.3,
        y: 0.4,
        color: '#00ff00',
        author: 'alice',
      }),
    );
  });

  it('does not dispatch on pointer down (waits for text input)', () => {
    const dispatch = vi.fn();
    const ctx = makeCtx({ dispatch });

    tool.onPointerDown(ctx, makeEvent(0.5, 0.5));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('pointer move is a no-op', () => {
    const setDraft = vi.fn();
    const ctx = makeCtx({ setDraft });

    // Move should not throw or set draft
    tool.onPointerMove(ctx, makeEvent(0.3, 0.3));
    expect(setDraft).not.toHaveBeenCalled();
  });

  it('pointer up is a no-op', () => {
    const dispatch = vi.fn();
    const ctx = makeCtx({ dispatch });

    tool.onPointerUp(ctx, makeEvent(0.3, 0.3));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('uses the current color from context', () => {
    const setDraft = vi.fn();
    const ctx = makeCtx({ setDraft, color: '#abcdef' });

    tool.onPointerDown(ctx, makeEvent(0.2, 0.8));
    const draftArg = setDraft.mock.calls[0][0];
    expect(draftArg.color).toBe('#abcdef');
  });

  it('uses the current author from context', () => {
    const setDraft = vi.fn();
    const ctx = makeCtx({ setDraft, author: 'bob' });

    tool.onPointerDown(ctx, makeEvent(0.5, 0.5));
    const draftArg = setDraft.mock.calls[0][0];
    expect(draftArg.author).toBe('bob');
  });

  it('creates a new draft on each pointer down', () => {
    const setDraft = vi.fn();
    const ctx = makeCtx({ setDraft });

    tool.onPointerDown(ctx, makeEvent(0.1, 0.1));
    tool.onPointerDown(ctx, makeEvent(0.9, 0.9));

    expect(setDraft).toHaveBeenCalledTimes(2);
    const first = setDraft.mock.calls[0][0];
    const second = setDraft.mock.calls[1][0];
    expect(first.x).toBeCloseTo(0.1, 5);
    expect(second.x).toBeCloseTo(0.9, 5);
  });
});
