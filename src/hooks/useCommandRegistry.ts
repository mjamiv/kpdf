/**
 * Hook to build the command list from current app state for the command palette.
 *
 * Integration with App.tsx:
 * - Pass the current tool list, dispatch function, and relevant app state.
 * - Returns an array of CommandItem objects for CommandPalette.
 * - Example:
 *     const commands = useCommandRegistry({
 *       tools: getAllTools(),
 *       dispatch,
 *       currentTool,
 *       setTool,
 *       zoom, setZoom,
 *       currentPage, pageCount, setCurrentPage,
 *       togglePanels: { shortcuts: toggleShortcuts, comments: toggleComments, markups: toggleMarkups },
 *     });
 *
 * The QA agent wires this into App.tsx and passes commands to CommandPalette.
 */

import { useMemo } from 'react';
import type { Tool } from '../types';
import { TOOL_SHORTCUTS } from '../tools/shortcuts';

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category: 'tool' | 'action' | 'navigation' | 'export' | 'view';
  icon?: string;
  action: () => void;
  enabled?: boolean;
};

export type CommandRegistryOptions = {
  setTool: (tool: Tool) => void;
  setLockedTool?: (tool: Tool | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  setZoom: (zoom: number) => void;
  currentPage: number;
  pageCount: number;
  setCurrentPage: (page: number) => void;
  togglePanels?: Record<string, () => void>;
  exportAnnotations?: () => void;
  exportPdf?: () => void;
  clearPage?: () => void;
  toggleReview?: () => void;
  toggleFlatten?: () => void;
  importSidecar?: () => void;
  importXfdf?: () => void;
  exportXfdf?: () => void;
  toggleScaleCalibration?: () => void;
  toggleToolPresets?: () => void;
  toggleScrollZoom?: () => void;
  toggleZoomWindow?: () => void;
};

/**
 * Core command builder shared by both the hook and the pure function.
 * Builds the full set of commands from options.
 */
function buildCommandsCore(options: CommandRegistryOptions): CommandItem[] {
  const commands: CommandItem[] = [];

  // Tool commands
  for (const shortcut of TOOL_SHORTCUTS) {
    commands.push({
      id: `tool-${shortcut.tool}`,
      label: `Tool: ${shortcut.label.replace(/ \(.\)$/, '')}`,
      description: `Switch to ${shortcut.tool} tool`,
      shortcut: shortcut.key.toUpperCase(),
      category: 'tool',
      action: () => options.setTool(shortcut.tool),
    });

    if (options.setLockedTool) {
      const lockTool = options.setLockedTool;
      commands.push({
        id: `tool-${shortcut.tool}-lock`,
        label: `Tool: ${shortcut.label.replace(/ \(.\)$/, '')} (Lock)`,
        description: `Switch to ${shortcut.tool} tool and lock it`,
        category: 'tool',
        action: () => { options.setTool(shortcut.tool); lockTool(shortcut.tool); },
      });
    }
  }

  // Undo/Redo
  commands.push({
    id: 'action-undo',
    label: 'Undo',
    description: 'Undo the last action',
    shortcut: 'Ctrl+Z',
    category: 'action',
    action: options.undo,
    enabled: options.canUndo,
  });

  commands.push({
    id: 'action-redo',
    label: 'Redo',
    description: 'Redo the last undone action',
    shortcut: 'Ctrl+Shift+Z',
    category: 'action',
    action: options.redo,
    enabled: options.canRedo,
  });

  // Zoom commands
  commands.push({
    id: 'view-zoom-in',
    label: 'Zoom In',
    description: `Current: ${Math.round(options.zoom * 100)}%`,
    shortcut: 'Ctrl++',
    category: 'view',
    action: () => options.setZoom(Math.min(options.zoom * 1.25, 5)),
  });

  commands.push({
    id: 'view-zoom-out',
    label: 'Zoom Out',
    description: `Current: ${Math.round(options.zoom * 100)}%`,
    shortcut: 'Ctrl+-',
    category: 'view',
    action: () => options.setZoom(Math.max(options.zoom / 1.25, 0.25)),
  });

  commands.push({
    id: 'view-zoom-fit',
    label: 'Zoom to Fit',
    description: 'Fit page to viewport',
    category: 'view',
    action: () => options.setZoom(1),
  });

  commands.push({
    id: 'view-zoom-100',
    label: 'Zoom to 100%',
    description: 'Set zoom to actual size',
    category: 'view',
    action: () => options.setZoom(1),
  });

  // Page navigation
  commands.push({
    id: 'nav-prev-page',
    label: 'Previous Page',
    description: `Page ${options.currentPage} of ${options.pageCount}`,
    category: 'navigation',
    action: () => options.setCurrentPage(Math.max(1, options.currentPage - 1)),
    enabled: options.currentPage > 1,
  });

  commands.push({
    id: 'nav-next-page',
    label: 'Next Page',
    description: `Page ${options.currentPage} of ${options.pageCount}`,
    category: 'navigation',
    action: () => options.setCurrentPage(Math.min(options.pageCount, options.currentPage + 1)),
    enabled: options.currentPage < options.pageCount,
  });

  commands.push({
    id: 'nav-first-page',
    label: 'Go to First Page',
    category: 'navigation',
    action: () => options.setCurrentPage(1),
    enabled: options.currentPage > 1,
  });

  commands.push({
    id: 'nav-last-page',
    label: 'Go to Last Page',
    category: 'navigation',
    action: () => options.setCurrentPage(options.pageCount),
    enabled: options.currentPage < options.pageCount,
  });

  // Panel toggles
  if (options.togglePanels) {
    for (const [name, toggle] of Object.entries(options.togglePanels)) {
      commands.push({
        id: `view-toggle-${name}`,
        label: `Toggle ${name.charAt(0).toUpperCase() + name.slice(1)} Panel`,
        description: `Show or hide the ${name} panel`,
        category: 'view',
        action: toggle,
      });
    }
  }

  // Extended commands (moved from toolbar)
  if (options.clearPage) {
    commands.push({ id: 'action-clear-page', label: 'Clear Page Annotations', description: 'Remove all annotations on current page', category: 'action', action: options.clearPage });
  }
  if (options.toggleReview) {
    commands.push({ id: 'action-toggle-review', label: 'Toggle Review Mode', description: 'Enable/disable review mode', category: 'action', action: options.toggleReview });
  }
  if (options.toggleFlatten) {
    commands.push({ id: 'action-toggle-flatten', label: 'Toggle Flatten on Save', description: 'Flatten annotations when saving', category: 'action', action: options.toggleFlatten });
  }
  if (options.importSidecar) {
    commands.push({ id: 'import-sidecar', label: 'Import Sidecar JSON', description: 'Load annotations from sidecar file', category: 'export', action: options.importSidecar });
  }
  if (options.importXfdf) {
    commands.push({ id: 'import-xfdf', label: 'Import XFDF', description: 'Import XFDF annotations', category: 'export', action: options.importXfdf });
  }
  if (options.exportXfdf) {
    commands.push({ id: 'export-xfdf', label: 'Export XFDF', description: 'Export annotations as XFDF', category: 'export', action: options.exportXfdf });
  }
  if (options.toggleScaleCalibration) {
    commands.push({ id: 'action-scale-calibration', label: 'Scale Calibration', description: 'Set measurement scale', category: 'action', action: options.toggleScaleCalibration });
  }
  if (options.toggleToolPresets) {
    commands.push({ id: 'action-tool-presets', label: 'Tool Presets', description: 'Load discipline presets', category: 'action', action: options.toggleToolPresets });
  }
  if (options.toggleScrollZoom) {
    commands.push({ id: 'action-scroll-zoom', label: 'Toggle Scroll-to-Zoom', description: 'Zoom on scroll without Ctrl', category: 'action', action: options.toggleScrollZoom });
  }
  if (options.toggleZoomWindow) {
    commands.push({ id: 'view-zoom-window', label: 'Zoom Window', description: 'Draw a box to zoom into an area', shortcut: 'W', category: 'view', action: options.toggleZoomWindow });
  }

  // Export commands
  if (options.exportAnnotations) {
    commands.push({
      id: 'export-annotations',
      label: 'Export Annotations',
      description: 'Export annotations as JSON',
      category: 'export',
      action: options.exportAnnotations,
    });
  }

  if (options.exportPdf) {
    commands.push({
      id: 'export-pdf',
      label: 'Export PDF',
      description: 'Export document with annotations',
      category: 'export',
      action: options.exportPdf,
    });
  }

  return commands;
}

export function useCommandRegistry(options: CommandRegistryOptions): CommandItem[] {
  return useMemo(() => buildCommandsCore(options), [options]);
}

/**
 * Pure function version for building commands (useful for testing without hooks).
 */
export function buildCommands(options: CommandRegistryOptions): CommandItem[] {
  return buildCommandsCore(options);
}
