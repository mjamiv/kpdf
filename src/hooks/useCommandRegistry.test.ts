import { describe, it, expect, vi } from 'vitest';
import { buildCommands, type CommandRegistryOptions } from './useCommandRegistry';

function makeOptions(overrides?: Partial<CommandRegistryOptions>): CommandRegistryOptions {
  return {
    setTool: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
    zoom: 1,
    setZoom: vi.fn(),
    currentPage: 3,
    pageCount: 10,
    setCurrentPage: vi.fn(),
    ...overrides,
  };
}

describe('buildCommands', () => {
  it('returns an array of commands', () => {
    const commands = buildCommands(makeOptions());
    expect(commands.length).toBeGreaterThan(0);
  });

  it('includes tool commands from TOOL_SHORTCUTS', () => {
    const commands = buildCommands(makeOptions());
    const toolCommands = commands.filter((c) => c.category === 'tool');
    expect(toolCommands.length).toBeGreaterThan(0);

    // Check for known tools
    const toolIds = toolCommands.map((c) => c.id);
    expect(toolIds).toContain('tool-pen');
    expect(toolIds).toContain('tool-select');
    expect(toolIds).toContain('tool-rectangle');
  });

  it('includes undo/redo commands', () => {
    const commands = buildCommands(makeOptions());
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('action-undo');
    expect(ids).toContain('action-redo');
  });

  it('undo command reflects canUndo state', () => {
    const commands = buildCommands(makeOptions({ canUndo: false }));
    const undo = commands.find((c) => c.id === 'action-undo');
    expect(undo?.enabled).toBe(false);
  });

  it('redo command reflects canRedo state', () => {
    const commands = buildCommands(makeOptions({ canRedo: false }));
    const redo = commands.find((c) => c.id === 'action-redo');
    expect(redo?.enabled).toBe(false);
  });

  it('includes zoom commands', () => {
    const commands = buildCommands(makeOptions());
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('view-zoom-in');
    expect(ids).toContain('view-zoom-out');
    expect(ids).toContain('view-zoom-fit');
  });

  it('includes navigation commands', () => {
    const commands = buildCommands(makeOptions());
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('nav-prev-page');
    expect(ids).toContain('nav-next-page');
  });

  it('prev page is disabled on first page', () => {
    const commands = buildCommands(makeOptions({ currentPage: 1 }));
    const prev = commands.find((c) => c.id === 'nav-prev-page');
    expect(prev?.enabled).toBe(false);
  });

  it('next page is disabled on last page', () => {
    const commands = buildCommands(makeOptions({ currentPage: 10, pageCount: 10 }));
    const next = commands.find((c) => c.id === 'nav-next-page');
    expect(next?.enabled).toBe(false);
  });

  it('includes panel toggle commands when provided', () => {
    const commands = buildCommands(
      makeOptions({
        togglePanels: {
          shortcuts: vi.fn(),
          comments: vi.fn(),
        },
      }),
    );
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('view-toggle-shortcuts');
    expect(ids).toContain('view-toggle-comments');
  });

  it('includes export commands when provided', () => {
    const commands = buildCommands(
      makeOptions({
        exportAnnotations: vi.fn(),
        exportPdf: vi.fn(),
      }),
    );
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('export-annotations');
    expect(ids).toContain('export-pdf');
  });

  it('does not include export commands when not provided', () => {
    const commands = buildCommands(makeOptions());
    const ids = commands.map((c) => c.id);
    expect(ids).not.toContain('export-annotations');
    expect(ids).not.toContain('export-pdf');
  });

  describe('command actions', () => {
    it('tool command calls setTool', () => {
      const setTool = vi.fn();
      const commands = buildCommands(makeOptions({ setTool }));
      const penCmd = commands.find((c) => c.id === 'tool-pen');
      penCmd?.action();
      expect(setTool).toHaveBeenCalledWith('pen');
    });

    it('undo command calls undo', () => {
      const undo = vi.fn();
      const commands = buildCommands(makeOptions({ undo }));
      const undoCmd = commands.find((c) => c.id === 'action-undo');
      undoCmd?.action();
      expect(undo).toHaveBeenCalled();
    });

    it('redo command calls redo', () => {
      const redo = vi.fn();
      const commands = buildCommands(makeOptions({ redo }));
      const redoCmd = commands.find((c) => c.id === 'action-redo');
      redoCmd?.action();
      expect(redo).toHaveBeenCalled();
    });

    it('zoom in command increases zoom', () => {
      const setZoom = vi.fn();
      const commands = buildCommands(makeOptions({ setZoom, zoom: 1 }));
      const zoomIn = commands.find((c) => c.id === 'view-zoom-in');
      zoomIn?.action();
      expect(setZoom).toHaveBeenCalledWith(expect.any(Number));
      const calledWith = setZoom.mock.calls[0][0] as number;
      expect(calledWith).toBeGreaterThan(1);
    });

    it('zoom out command decreases zoom', () => {
      const setZoom = vi.fn();
      const commands = buildCommands(makeOptions({ setZoom, zoom: 1 }));
      const zoomOut = commands.find((c) => c.id === 'view-zoom-out');
      zoomOut?.action();
      expect(setZoom).toHaveBeenCalledWith(expect.any(Number));
      const calledWith = setZoom.mock.calls[0][0] as number;
      expect(calledWith).toBeLessThan(1);
    });

    it('prev page command decrements page', () => {
      const setCurrentPage = vi.fn();
      const commands = buildCommands(makeOptions({ setCurrentPage, currentPage: 5 }));
      const prev = commands.find((c) => c.id === 'nav-prev-page');
      prev?.action();
      expect(setCurrentPage).toHaveBeenCalledWith(4);
    });

    it('next page command increments page', () => {
      const setCurrentPage = vi.fn();
      const commands = buildCommands(makeOptions({ setCurrentPage, currentPage: 5, pageCount: 10 }));
      const next = commands.find((c) => c.id === 'nav-next-page');
      next?.action();
      expect(setCurrentPage).toHaveBeenCalledWith(6);
    });
  });

  describe('categories', () => {
    it('all commands have valid categories', () => {
      const commands = buildCommands(
        makeOptions({
          togglePanels: { test: vi.fn() },
          exportAnnotations: vi.fn(),
        }),
      );
      const validCategories = ['tool', 'action', 'navigation', 'export', 'view'];
      for (const cmd of commands) {
        expect(validCategories).toContain(cmd.category);
      }
    });

    it('each command has a unique id', () => {
      const commands = buildCommands(
        makeOptions({
          togglePanels: { shortcuts: vi.fn(), comments: vi.fn() },
          exportAnnotations: vi.fn(),
          exportPdf: vi.fn(),
        }),
      );
      const ids = commands.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('tool commands have shortcuts', () => {
      const commands = buildCommands(makeOptions());
      const toolCommands = commands.filter((c) => c.category === 'tool');
      for (const cmd of toolCommands) {
        expect(cmd.shortcut).toBeDefined();
        expect(cmd.shortcut?.length).toBeGreaterThan(0);
      }
    });
  });
});
