import { describe, it, expect, vi, beforeEach } from 'vitest';
import calloutTool, { isCalloutDraft } from './calloutTool';
import type { ToolContext } from './registry';

function makeEvent(x: number, y: number): NormalizedPointerEvent {
  return { point: { x, y }, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };
}

describe('calloutTool', () => {
  let ctx: ToolContext;
  let draftState: unknown;

  beforeEach(() => {
    draftState = null;
    ctx = {
      draft: null,
      setDraft: vi.fn((v: unknown) => {
        draftState = typeof v === 'function' ? (v as (prev: unknown) => unknown)(draftState) : v;
        ctx.draft = draftState;
      }),
      dispatch: vi.fn(),
      color: '#ff0000',
      author: 'tester',
      page: 1,
      randomId: () => 'test-id',
      nextZIndex: () => 1,
    } as unknown as ToolContext;
  });

  it('has correct metadata', () => {
    expect(calloutTool.name).toBe('callout');
    expect(calloutTool.cursor).toBe('crosshair');
  });

  it('isCalloutDraft returns false for non-callout', () => {
    expect(isCalloutDraft(null)).toBe(false);
    expect(isCalloutDraft({ toolType: 'pen' })).toBe(false);
  });

  it('phase 1: places anchor on first click', () => {
    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    expect(isCalloutDraft(ctx.draft)).toBe(true);
    const draft = ctx.draft as { phase: number; anchor: { x: number; y: number } };
    expect(draft.phase).toBe(1);
    expect(draft.anchor).toEqual({ x: 0.1, y: 0.15 });
  });

  it('phase 2: places knee on second click', () => {
    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerDown!(ctx, makeEvent(0.2, 0.3));
    const draft = ctx.draft as { phase: number; knee: { x: number; y: number } };
    expect(draft.phase).toBe(2);
    expect(draft.knee).toEqual({ x: 0.2, y: 0.3 });
  });

  it('phase 3: starts box drag on third click', () => {
    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerDown!(ctx, makeEvent(0.2, 0.3));
    calloutTool.onPointerDown!(ctx, makeEvent(0.3, 0.3));
    const draft = ctx.draft as { phase: number; boxStart: { x: number; y: number } };
    expect(draft.phase).toBe(3);
    expect(draft.boxStart).toEqual({ x: 0.3, y: 0.3 });
  });

  it('updates cursor on pointer move in phase 1', () => {
    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerMove!(ctx, makeEvent(0.5, 0.5));
    const draft = ctx.draft as { cursor: { x: number; y: number } };
    expect(draft.cursor).toEqual({ x: 0.5, y: 0.5 });
  });

  it('updates boxEnd on pointer move in phase 3', () => {
    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerDown!(ctx, makeEvent(0.2, 0.3));
    calloutTool.onPointerDown!(ctx, makeEvent(0.3, 0.3));
    calloutTool.onPointerMove!(ctx, makeEvent(0.5, 0.4));
    const draft = ctx.draft as { boxEnd: { x: number; y: number } };
    expect(draft.boxEnd).toEqual({ x: 0.5, y: 0.4 });
  });

  it('dispatches ADD_ANNOTATION on phase 3 pointerUp with text', () => {
    globalThis.prompt = vi.fn().mockReturnValue('Test callout') as unknown as typeof globalThis.prompt;

    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerDown!(ctx, makeEvent(0.2, 0.3));
    calloutTool.onPointerDown!(ctx, makeEvent(0.3, 0.3));
    calloutTool.onPointerMove!(ctx, makeEvent(0.5, 0.4));
    calloutTool.onPointerUp!(ctx, makeEvent(0.5, 0.4));

    expect(ctx.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADD_ANNOTATION',
      page: 1,
    }));

    const action = (ctx.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(action.annotation.type).toBe('callout');
    expect(action.annotation.text).toBe('Test callout');
    expect(action.annotation.leaderTarget).toEqual({ x: 0.1, y: 0.15 });
    expect(action.annotation.knee).toEqual({ x: 0.2, y: 0.3 });
    expect(action.annotation.box).toBeDefined();
    expect(action.annotation.box.width).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it('clears draft when user cancels text prompt', () => {
    globalThis.prompt = vi.fn().mockReturnValue(null) as unknown as typeof globalThis.prompt;

    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerDown!(ctx, makeEvent(0.2, 0.3));
    calloutTool.onPointerDown!(ctx, makeEvent(0.3, 0.3));
    calloutTool.onPointerMove!(ctx, makeEvent(0.5, 0.4));
    calloutTool.onPointerUp!(ctx, makeEvent(0.5, 0.4));

    expect(ctx.dispatch).not.toHaveBeenCalled();
    expect(ctx.draft).toBeNull();

    vi.restoreAllMocks();
  });

  it('creates default box when user just clicks without dragging', () => {
    globalThis.prompt = vi.fn().mockReturnValue('Small callout') as unknown as typeof globalThis.prompt;

    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerDown!(ctx, makeEvent(0.2, 0.3));
    calloutTool.onPointerDown!(ctx, makeEvent(0.4, 0.4));
    // No move — immediate pointerUp at same point
    calloutTool.onPointerUp!(ctx, makeEvent(0.4, 0.4));

    const action = (ctx.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(action.annotation.box.width).toBeCloseTo(0.12);
    expect(action.annotation.box.height).toBeCloseTo(0.04);

    vi.restoreAllMocks();
  });

  it('does not finalize on pointerUp during phase 1 or 2', () => {
    calloutTool.onPointerDown!(ctx, makeEvent(0.1, 0.15));
    calloutTool.onPointerUp!(ctx, makeEvent(0.1, 0.15));
    // Should still be in draft (phase 1, waiting for next click)
    expect(ctx.dispatch).not.toHaveBeenCalled();
    expect(isCalloutDraft(ctx.draft)).toBe(true);
  });
});
