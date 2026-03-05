import { describe, it, expect, vi } from 'vitest';
import { isCountDraft } from './countTool';
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

describe('countTool', () => {
  it('is registered', () => {
    expect(getTool('count')).toBeDefined();
  });

  it('isCountDraft returns false for non-count drafts', () => {
    expect(isCountDraft(null)).toBe(false);
    expect(isCountDraft({ toolType: 'pen' })).toBe(false);
  });

  it('commits immediately on first click and sets draft', () => {
    const tool = getTool('count')!;
    const ctx = makeCtx();
    tool.onPointerDown(ctx, makeEvent(0.3, 0.4));
    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ANNOTATION',
        annotation: expect.objectContaining({
          type: 'count',
          x: 0.3,
          y: 0.4,
          number: 1,
          radius: 0.012,
        }),
      }),
    );
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ toolType: 'count', nextNumber: 2 }),
    );
  });

  it('increments number on subsequent clicks', () => {
    const tool = getTool('count')!;
    const draft = { toolType: 'count', lastMouse: { x: 0.3, y: 0.4 }, groupId: 'g1', nextNumber: 3, color: '#ff0000' };
    const ctx = makeCtx({ draft });
    tool.onPointerDown(ctx, makeEvent(0.5, 0.6));
    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        annotation: expect.objectContaining({ number: 3 }),
      }),
    );
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ nextNumber: 4 }),
    );
  });

  it('clears draft on Escape', () => {
    const tool = getTool('count')!;
    const ctx = makeCtx({ draft: { toolType: 'count', lastMouse: { x: 0, y: 0 }, groupId: 'g1', nextNumber: 2, color: '#ff0000' } });
    tool.onKeyDown!(ctx, { key: 'Escape' } as KeyboardEvent);
    expect(ctx.setDraft).toHaveBeenCalledWith(null);
  });

  it('clears draft on Enter', () => {
    const tool = getTool('count')!;
    const ctx = makeCtx({ draft: { toolType: 'count', lastMouse: { x: 0, y: 0 }, groupId: 'g1', nextNumber: 2, color: '#ff0000' } });
    tool.onKeyDown!(ctx, { key: 'Enter' } as KeyboardEvent);
    expect(ctx.setDraft).toHaveBeenCalledWith(null);
  });
});
