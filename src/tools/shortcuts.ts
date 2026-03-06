import type { Tool } from '../types';

export type ShortcutDef = {
  key: string;
  tool: Tool;
  label: string;
};

export const TOOL_SHORTCUTS: ShortcutDef[] = [
  { key: 'v', tool: 'select', label: 'Select (V)' },
  { key: 'p', tool: 'pen', label: 'Pen (P)' },
  { key: 'r', tool: 'rectangle', label: 'Rectangle (R)' },
  { key: 'h', tool: 'highlight', label: 'Highlight (H)' },
  { key: 't', tool: 'text', label: 'Text (T)' },
  { key: 'a', tool: 'arrow', label: 'Arrow (A)' },
  { key: 'c', tool: 'callout', label: 'Callout (C)' },
  { key: 'k', tool: 'cloud', label: 'Cloud (K)' },
  { key: 'm', tool: 'measurement', label: 'Measurement (M)' },
  { key: 'g', tool: 'polygon', label: 'Polygon (G)' },
  { key: 's', tool: 'stamp', label: 'Stamp (S)' },
  { key: 'e', tool: 'area', label: 'Area (E)' },
  { key: 'n', tool: 'angle', label: 'Angle (N)' },
  { key: 'x', tool: 'count', label: 'Count (X)' },
  { key: 'd', tool: 'dimension', label: 'Dimension (D)' },
  { key: 'o', tool: 'ellipse', label: 'Ellipse (O)' },
  { key: 'l', tool: 'polyline', label: 'Polyline (L)' },
  { key: 'u', tool: 'hyperlink', label: 'Hyperlink (U)' },
];

export function getToolForKey(key: string): Tool | null {
  const shortcut = TOOL_SHORTCUTS.find((s) => s.key === key.toLowerCase());
  return shortcut?.tool ?? null;
}
