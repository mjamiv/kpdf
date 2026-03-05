import type { Annotation, Tool } from '../types';

export type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  action: () => void;
};

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

  return items;
}
