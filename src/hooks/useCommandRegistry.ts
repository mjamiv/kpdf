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
};

export function useCommandRegistry(options: CommandRegistryOptions): CommandItem[] {
  const {
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    setZoom,
    currentPage,
    pageCount,
    setCurrentPage,
    togglePanels,
    exportAnnotations,
    exportPdf,
  } = options;

  return useMemo(() => {
    const commands: CommandItem[] = [];

    // Tool commands from shortcuts
    for (const shortcut of TOOL_SHORTCUTS) {
      commands.push({
        id: `tool-${shortcut.tool}`,
        label: `Tool: ${shortcut.label.replace(/ \(.\)$/, '')}`,
        description: `Switch to ${shortcut.tool} tool`,
        shortcut: shortcut.key.toUpperCase(),
        category: 'tool',
        action: () => setTool(shortcut.tool),
      });
    }

    // Undo/Redo
    commands.push({
      id: 'action-undo',
      label: 'Undo',
      description: 'Undo the last action',
      shortcut: 'Ctrl+Z',
      category: 'action',
      action: undo,
      enabled: canUndo,
    });

    commands.push({
      id: 'action-redo',
      label: 'Redo',
      description: 'Redo the last undone action',
      shortcut: 'Ctrl+Shift+Z',
      category: 'action',
      action: redo,
      enabled: canRedo,
    });

    // Zoom commands
    commands.push({
      id: 'view-zoom-in',
      label: 'Zoom In',
      description: `Current: ${Math.round(zoom * 100)}%`,
      shortcut: 'Ctrl++',
      category: 'view',
      action: () => setZoom(Math.min(zoom * 1.25, 5)),
    });

    commands.push({
      id: 'view-zoom-out',
      label: 'Zoom Out',
      description: `Current: ${Math.round(zoom * 100)}%`,
      shortcut: 'Ctrl+-',
      category: 'view',
      action: () => setZoom(Math.max(zoom / 1.25, 0.25)),
    });

    commands.push({
      id: 'view-zoom-fit',
      label: 'Zoom to Fit',
      description: 'Fit page to viewport',
      category: 'view',
      action: () => setZoom(1),
    });

    commands.push({
      id: 'view-zoom-100',
      label: 'Zoom to 100%',
      description: 'Set zoom to actual size',
      category: 'view',
      action: () => setZoom(1),
    });

    // Page navigation
    commands.push({
      id: 'nav-prev-page',
      label: 'Previous Page',
      description: `Page ${currentPage} of ${pageCount}`,
      category: 'navigation',
      action: () => setCurrentPage(Math.max(1, currentPage - 1)),
      enabled: currentPage > 1,
    });

    commands.push({
      id: 'nav-next-page',
      label: 'Next Page',
      description: `Page ${currentPage} of ${pageCount}`,
      category: 'navigation',
      action: () => setCurrentPage(Math.min(pageCount, currentPage + 1)),
      enabled: currentPage < pageCount,
    });

    commands.push({
      id: 'nav-first-page',
      label: 'Go to First Page',
      category: 'navigation',
      action: () => setCurrentPage(1),
      enabled: currentPage > 1,
    });

    commands.push({
      id: 'nav-last-page',
      label: 'Go to Last Page',
      category: 'navigation',
      action: () => setCurrentPage(pageCount),
      enabled: currentPage < pageCount,
    });

    // Panel toggles
    if (togglePanels) {
      for (const [name, toggle] of Object.entries(togglePanels)) {
        commands.push({
          id: `view-toggle-${name}`,
          label: `Toggle ${name.charAt(0).toUpperCase() + name.slice(1)} Panel`,
          description: `Show or hide the ${name} panel`,
          category: 'view',
          action: toggle,
        });
      }
    }

    // Export commands
    if (exportAnnotations) {
      commands.push({
        id: 'export-annotations',
        label: 'Export Annotations',
        description: 'Export annotations as JSON',
        category: 'export',
        action: exportAnnotations,
      });
    }

    if (exportPdf) {
      commands.push({
        id: 'export-pdf',
        label: 'Export PDF',
        description: 'Export document with annotations',
        category: 'export',
        action: exportPdf,
      });
    }

    return commands;
  }, [
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    setZoom,
    currentPage,
    pageCount,
    setCurrentPage,
    togglePanels,
    exportAnnotations,
    exportPdf,
  ]);
}

/**
 * Pure function version for building commands (useful for testing without hooks).
 */
export function buildCommands(options: CommandRegistryOptions): CommandItem[] {
  // Delegate to the same logic -- extracted for testability
  const commands: CommandItem[] = [];

  for (const shortcut of TOOL_SHORTCUTS) {
    commands.push({
      id: `tool-${shortcut.tool}`,
      label: `Tool: ${shortcut.label.replace(/ \(.\)$/, '')}`,
      description: `Switch to ${shortcut.tool} tool`,
      shortcut: shortcut.key.toUpperCase(),
      category: 'tool',
      action: () => options.setTool(shortcut.tool),
    });
  }

  commands.push({
    id: 'action-undo',
    label: 'Undo',
    shortcut: 'Ctrl+Z',
    category: 'action',
    action: options.undo,
    enabled: options.canUndo,
  });

  commands.push({
    id: 'action-redo',
    label: 'Redo',
    shortcut: 'Ctrl+Shift+Z',
    category: 'action',
    action: options.redo,
    enabled: options.canRedo,
  });

  commands.push({
    id: 'view-zoom-in',
    label: 'Zoom In',
    shortcut: 'Ctrl++',
    category: 'view',
    action: () => options.setZoom(Math.min(options.zoom * 1.25, 5)),
  });

  commands.push({
    id: 'view-zoom-out',
    label: 'Zoom Out',
    shortcut: 'Ctrl+-',
    category: 'view',
    action: () => options.setZoom(Math.max(options.zoom / 1.25, 0.25)),
  });

  commands.push({
    id: 'view-zoom-fit',
    label: 'Zoom to Fit',
    category: 'view',
    action: () => options.setZoom(1),
  });

  commands.push({
    id: 'nav-prev-page',
    label: 'Previous Page',
    category: 'navigation',
    action: () => options.setCurrentPage(Math.max(1, options.currentPage - 1)),
    enabled: options.currentPage > 1,
  });

  commands.push({
    id: 'nav-next-page',
    label: 'Next Page',
    category: 'navigation',
    action: () => options.setCurrentPage(Math.min(options.pageCount, options.currentPage + 1)),
    enabled: options.currentPage < options.pageCount,
  });

  if (options.togglePanels) {
    for (const [name, toggle] of Object.entries(options.togglePanels)) {
      commands.push({
        id: `view-toggle-${name}`,
        label: `Toggle ${name.charAt(0).toUpperCase() + name.slice(1)} Panel`,
        category: 'view',
        action: toggle,
      });
    }
  }

  if (options.exportAnnotations) {
    commands.push({
      id: 'export-annotations',
      label: 'Export Annotations',
      category: 'export',
      action: options.exportAnnotations,
    });
  }

  if (options.exportPdf) {
    commands.push({
      id: 'export-pdf',
      label: 'Export PDF',
      category: 'export',
      action: options.exportPdf,
    });
  }

  return commands;
}
