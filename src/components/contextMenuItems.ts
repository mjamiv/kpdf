import type { Annotation, Tool } from '../types';

export type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  action: () => void;
};

const QUICK_SWITCH_TOOLS: { tool: Tool; label: string; shortcut: string }[] = [
  { tool: 'select', label: 'Select', shortcut: 'V' },
  { tool: 'pen', label: 'Pen', shortcut: 'P' },
  { tool: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { tool: 'highlight', label: 'Highlight', shortcut: 'H' },
  { tool: 'text', label: 'Text', shortcut: 'T' },
];

export function buildCanvasMenuItems(
  annotation: Annotation | null,
  opts: {
    onDelete?: () => void;
    onCopy?: () => void;
    onChangeColor?: () => void;
    onBringToFront?: () => void;
    onSendToBack?: () => void;
    onDeselect?: () => void;
    onSelectAll?: () => void;
    onPaste?: () => void;
    onSwitchTool?: (tool: Tool) => void;
    tool: Tool;
  },
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (annotation) {
    if (opts.onCopy) items.push({ id: 'copy', label: 'Copy', shortcut: 'Cmd+C', action: opts.onCopy });
    if (opts.onChangeColor) items.push({ id: 'color', label: 'Change Color…', action: opts.onChangeColor });
    if (opts.onBringToFront) items.push({ id: 'front', label: 'Bring to Front', action: opts.onBringToFront });
    if (opts.onSendToBack) items.push({ id: 'back', label: 'Send to Back', action: opts.onSendToBack });
    if (opts.onDelete) items.push({ id: 'delete', label: 'Delete', shortcut: '⌫', danger: true, action: opts.onDelete });
  } else {
    if (opts.onPaste) items.push({ id: 'paste', label: 'Paste', shortcut: 'Cmd+V', action: opts.onPaste });
    if (opts.onSelectAll) items.push({ id: 'select-all', label: 'Select All', shortcut: 'Cmd+A', action: opts.onSelectAll });
  }

  if (opts.onDeselect && annotation) {
    items.push({ id: 'deselect', label: 'Deselect', shortcut: 'Esc', action: opts.onDeselect });
  }

  if (!annotation && opts.onSwitchTool) {
    for (const qt of QUICK_SWITCH_TOOLS) {
      if (qt.tool !== opts.tool) {
        items.push({
          id: `switch-${qt.tool}`,
          label: `Switch to ${qt.label}`,
          shortcut: qt.shortcut,
          action: () => opts.onSwitchTool!(qt.tool),
        });
      }
    }
  }

  return items;
}
