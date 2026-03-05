import { describe, it, expect, vi } from 'vitest';
import { isAreaDraft, shoelaceArea } from './areaTool';
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

describe('areaTool', () => {
  it('is registered', () => {
    expect(getTool('area')).toBeDefined();
  });

  it('isAreaDraft returns false for non-area drafts', () => {
    expect(isAreaDraft(null)).toBe(false);
    expect(isAreaDraft({ toolType: 'pen' })).toBe(false);
  });

  it('starts a draft on first click', () => {
    const tool = getTool('area')!;
    const ctx = makeCtx();
    tool.onPointerDown(ctx, makeEvent(0.1, 0.2));
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ toolType: 'area', points: [{ x: 0.1, y: 0.2 }] }),
    );
  });

  it('adds points on subsequent clicks', () => {
    const tool = getTool('area')!;
    const draft = { toolType: 'area', points: [{ x: 0.1, y: 0.1 }], lastMouse: { x: 0.3, y: 0.3 }, color: '#ff0000' };
    const ctx = makeCtx({ draft });
    tool.onPointerDown(ctx, makeEvent(0.3, 0.3));
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }] }),
    );
  });

  it('commits on close near first point', () => {
    const tool = getTool('area')!;
    const draft = {
      toolType: 'area',
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }],
      lastMouse: { x: 0.1, y: 0.1 },
      color: '#ff0000',
    };
    const ctx = makeCtx({ draft });
    tool.onPointerDown(ctx, makeEvent(0.105, 0.105));
    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ANNOTATION',
        annotation: expect.objectContaining({ type: 'area' }),
      }),
    );
    expect(ctx.setDraft).toHaveBeenCalledWith(null);
  });

  describe('shoelaceArea', () => {
    it('computes area of a unit square', () => {
      const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
      expect(shoelaceArea(points)).toBeCloseTo(1.0);
    });

    it('computes area of a triangle', () => {
      const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
      expect(shoelaceArea(points)).toBeCloseTo(0.5);
    });
  });
});
