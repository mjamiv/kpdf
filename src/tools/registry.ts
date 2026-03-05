import type { Annotation, Tool, Point, PageScale } from '../types';
import type { Action } from '../engine/actions';
import type { SelectionState } from '../engine/selection';

export type NormalizedPointerEvent = {
  point: Point;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type ToolContext = {
  dispatch(action: Action): void;
  page: number;
  color: string;
  author: string;
  annotations: Annotation[];
  selection: SelectionState;
  draft: unknown;
  setDraft(draft: unknown | ((prev: unknown) => unknown)): void;
  setSelection(sel: SelectionState): void;
  nextZIndex(): number;
  randomId(): string;
  pageScale?: PageScale;
};

export type ToolBehavior = {
  name: Tool;
  label: string;
  cursor: string;
  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent): void;
  onPointerMove(ctx: ToolContext, e: NormalizedPointerEvent): void;
  onPointerUp(ctx: ToolContext, e: NormalizedPointerEvent): void;
  onKeyDown?(ctx: ToolContext, e: KeyboardEvent): void;
  renderDraft?(ctx: CanvasRenderingContext2D, draft: unknown, w: number, h: number): void;
};

const tools = new Map<Tool, ToolBehavior>();

export function registerTool(tool: ToolBehavior): void {
  tools.set(tool.name, tool);
}

export function getTool(name: Tool): ToolBehavior | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolBehavior[] {
  return Array.from(tools.values());
}
