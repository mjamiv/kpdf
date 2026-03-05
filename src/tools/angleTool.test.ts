import { describe, it, expect, vi } from 'vitest';
import { isAngleDraft, computeAngleDeg } from './angleTool';
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

describe('angleTool', () => {
  it('is registered', () => {
    expect(getTool('angle')).toBeDefined();
  });

  it('isAngleDraft returns false for non-angle drafts', () => {
    expect(isAngleDraft(null)).toBe(false);
    expect(isAngleDraft({ toolType: 'pen' })).toBe(false);
  });

  it('starts draft on first click', () => {
    const tool = getTool('angle')!;
    const ctx = makeCtx();
    tool.onPointerDown(ctx, makeEvent(0.5, 0.5));
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ toolType: 'angle', clicks: [{ x: 0.5, y: 0.5 }] }),
    );
  });

  it('adds ray1 on second click', () => {
    const tool = getTool('angle')!;
    const draft = { toolType: 'angle', clicks: [{ x: 0.5, y: 0.5 }], lastMouse: { x: 0.8, y: 0.5 }, color: '#ff0000' };
    const ctx = makeCtx({ draft });
    tool.onPointerDown(ctx, makeEvent(0.8, 0.5));
    expect(ctx.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ clicks: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }] }),
    );
  });

  it('commits on third click', () => {
    const tool = getTool('angle')!;
    const draft = {
      toolType: 'angle',
      clicks: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }],
      lastMouse: { x: 0.5, y: 0.2 },
      color: '#ff0000',
    };
    const ctx = makeCtx({ draft });
    tool.onPointerDown(ctx, makeEvent(0.5, 0.2));
    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ANNOTATION',
        annotation: expect.objectContaining({ type: 'angle', vertex: { x: 0.5, y: 0.5 } }),
      }),
    );
    expect(ctx.setDraft).toHaveBeenCalledWith(null);
  });

  describe('computeAngleDeg', () => {
    it('computes 90 degrees', () => {
      const v = { x: 0, y: 0 };
      const r1 = { x: 1, y: 0 };
      const r2 = { x: 0, y: 1 };
      expect(computeAngleDeg(v, r1, r2)).toBeCloseTo(90);
    });

    it('computes 180 degrees', () => {
      const v = { x: 0, y: 0 };
      const r1 = { x: 1, y: 0 };
      const r2 = { x: -1, y: 0 };
      expect(computeAngleDeg(v, r1, r2)).toBeCloseTo(180);
    });

    it('computes 45 degrees', () => {
      const v = { x: 0, y: 0 };
      const r1 = { x: 1, y: 0 };
      const r2 = { x: 1, y: 1 };
      expect(computeAngleDeg(v, r1, r2)).toBeCloseTo(45);
    });
  });
});
