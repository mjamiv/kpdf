import { describe, it, expect, vi } from 'vitest';
import { isDimensionDraft } from './dimensionTool';
import type { ToolContext, NormalizedPointerEvent } from './registry';
import { getTool } from './index';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    dispatch: vi.fn(),
    page: 1,
    color: '#ff0000',
    author: 'test',
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

describe('dimensionTool', () => {
  it('is registered', () => {
    expect(getTool('dimension')).toBeDefined();
  });

  it('isDimensionDraft returns false for non-dimension drafts', () => {
    expect(isDimensionDraft(null)).toBe(false);
    expect(isDimensionDraft({ toolType: 'pen' })).toBe(false);
  });

  it('starts draft on pointerDown', () => {
    const tool = getTool('dimension')!;
    const ctx = makeCtx();
    tool.onPointerDown(ctx, makeEvent(0.1, 0.2));
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ toolType: 'dimension', start: { x: 0.1, y: 0.2 } }),
    );
  });

  it('commits on pointerUp with sufficient distance', () => {
    const tool = getTool('dimension')!;
    const draft = { toolType: 'dimension', start: { x: 0.1, y: 0.1 }, end: { x: 0.5, y: 0.5 }, color: '#ff0000' };
    const ctx = makeCtx({ draft });
    tool.onPointerUp(ctx, makeEvent(0.5, 0.5));
    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ANNOTATION',
        annotation: expect.objectContaining({
          type: 'dimension',
          offset: 0.015,
          start: { x: 0.1, y: 0.1 },
          end: { x: 0.5, y: 0.5 },
        }),
      }),
    );
    expect(ctx.setDraft).toHaveBeenCalledWith(null);
  });

  it('does not commit on tiny drag', () => {
    const tool = getTool('dimension')!;
    const draft = { toolType: 'dimension', start: { x: 0.1, y: 0.1 }, end: { x: 0.1005, y: 0.1 }, color: '#ff0000' };
    const ctx = makeCtx({ draft });
    tool.onPointerUp(ctx, makeEvent(0.1005, 0.1));
    expect(ctx.dispatch).not.toHaveBeenCalled();
    expect(ctx.setDraft).toHaveBeenCalledWith(null);
  });
});
