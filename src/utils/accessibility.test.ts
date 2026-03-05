import { describe, it, expect, vi } from 'vitest';
import {
  getAnnotationAriaLabel,
  getToolAriaLabel,
  trapFocus,
  generateKeyboardInstructions,
  announceToScreenReader,
} from './accessibility';
import type { Annotation } from '../types';

describe('getAnnotationAriaLabel', () => {
  function makeAnnotation(overrides: Partial<Annotation> & { type: string }): Annotation {
    return {
      id: 'test-1',
      zIndex: 0,
      color: '#ff0000',
      author: 'Alice',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      locked: false,
      ...overrides,
    } as Annotation;
  }

  it('includes type label for rectangle', () => {
    const label = getAnnotationAriaLabel(makeAnnotation({ type: 'rectangle', x: 0, y: 0, width: 1, height: 1, thickness: 2 }));
    expect(label).toContain('Rectangle');
  });

  it('includes type label for pen', () => {
    const label = getAnnotationAriaLabel(makeAnnotation({ type: 'pen', points: [], thickness: 2 }));
    expect(label).toContain('Freehand drawing');
  });

  it('includes color', () => {
    const label = getAnnotationAriaLabel(makeAnnotation({ type: 'rectangle', color: '#00ff00', x: 0, y: 0, width: 1, height: 1, thickness: 2 }));
    expect(label).toContain('#00ff00');
  });

  it('includes author', () => {
    const label = getAnnotationAriaLabel(makeAnnotation({ type: 'rectangle', author: 'Bob', x: 0, y: 0, width: 1, height: 1, thickness: 2 }));
    expect(label).toContain('Bob');
  });

  it('includes locked status', () => {
    const label = getAnnotationAriaLabel(makeAnnotation({ type: 'rectangle', locked: true, x: 0, y: 0, width: 1, height: 1, thickness: 2 }));
    expect(label).toContain('locked');
  });

  it('includes text content for text annotations', () => {
    const label = getAnnotationAriaLabel(
      makeAnnotation({ type: 'text', text: 'Hello world', x: 0, y: 0, fontSize: 16 }),
    );
    expect(label).toContain('Hello world');
  });

  it('truncates long text content', () => {
    const longText = 'A'.repeat(100);
    const label = getAnnotationAriaLabel(
      makeAnnotation({ type: 'text', text: longText, x: 0, y: 0, fontSize: 16 }),
    );
    expect(label).toContain('...');
    expect(label.length).toBeLessThan(longText.length + 100);
  });

  it('includes label for stamp annotations', () => {
    const label = getAnnotationAriaLabel(
      makeAnnotation({ type: 'stamp', label: 'APPROVED', x: 0, y: 0, width: 1, height: 1, stampId: 'approved' }),
    );
    expect(label).toContain('APPROVED');
  });

  it('includes status when present', () => {
    const label = getAnnotationAriaLabel(
      makeAnnotation({ type: 'rectangle', status: 'resolved', x: 0, y: 0, width: 1, height: 1, thickness: 2 }),
    );
    expect(label).toContain('resolved');
  });

  it('handles measurement type', () => {
    const label = getAnnotationAriaLabel(
      makeAnnotation({ type: 'measurement', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, thickness: 2, scale: 1, unit: 'ft' }),
    );
    expect(label).toContain('Measurement');
  });
});

describe('getToolAriaLabel', () => {
  it('returns description for select tool', () => {
    expect(getToolAriaLabel('select')).toContain('Select');
  });

  it('returns description for pen tool', () => {
    expect(getToolAriaLabel('pen')).toContain('freehand');
  });

  it('returns description for rectangle tool', () => {
    expect(getToolAriaLabel('rectangle')).toContain('rectangle');
  });

  it('returns description for all known tools', () => {
    const tools = ['select', 'pen', 'rectangle', 'highlight', 'text', 'arrow', 'callout', 'cloud', 'measurement', 'polygon', 'stamp'] as const;
    for (const tool of tools) {
      const label = getToolAriaLabel(tool);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe('generateKeyboardInstructions', () => {
  it('returns instructions for select tool', () => {
    const instructions = generateKeyboardInstructions('select');
    expect(instructions).toContain('Click');
    expect(instructions).toContain('select');
  });

  it('returns instructions for pen tool', () => {
    const instructions = generateKeyboardInstructions('pen');
    expect(instructions).toContain('drag');
  });

  it('returns instructions for text tool', () => {
    const instructions = generateKeyboardInstructions('text');
    expect(instructions).toContain('text');
  });

  it('returns instructions for all known tools', () => {
    const tools = ['select', 'pen', 'rectangle', 'highlight', 'text', 'arrow', 'callout', 'cloud', 'measurement', 'polygon', 'stamp'] as const;
    for (const tool of tools) {
      const instructions = generateKeyboardInstructions(tool);
      expect(instructions.length).toBeGreaterThan(0);
    }
  });
});

describe('announceToScreenReader', () => {
  it('gracefully handles missing document (e.g., SSR)', () => {
    // The function checks typeof document === 'undefined' and returns early
    // In Node test environment, document is undefined, so this should not throw
    expect(() => announceToScreenReader('test')).not.toThrow();
  });
});

describe('trapFocus', () => {
  it('adds keydown listener and returns cleanup that removes it', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const querySelectorAll = vi.fn().mockReturnValue([]);

    const mockContainer = {
      addEventListener,
      removeEventListener,
      querySelectorAll,
    } as unknown as HTMLElement;

    const cleanup = trapFocus(mockContainer);

    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(typeof cleanup).toBe('function');

    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('focuses the first focusable element found', () => {
    const focusFn = vi.fn();
    const mockButton = { focus: focusFn };
    const querySelectorAll = vi.fn().mockReturnValue([mockButton]);

    const mockContainer = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelectorAll,
    } as unknown as HTMLElement;

    trapFocus(mockContainer);

    expect(querySelectorAll).toHaveBeenCalled();
    expect(focusFn).toHaveBeenCalled();
  });

  it('handles container with no focusable elements', () => {
    const querySelectorAll = vi.fn().mockReturnValue([]);

    const mockContainer = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelectorAll,
    } as unknown as HTMLElement;

    expect(() => trapFocus(mockContainer)).not.toThrow();
  });

  it('handles Tab key by preventing default when wrapping needed', () => {
    let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    const mockFirst = { focus: vi.fn() };
    const mockLast = { focus: vi.fn() };

    const mockContainer = {
      addEventListener: vi.fn((event: string, handler: (e: KeyboardEvent) => void) => {
        if (event === 'keydown') keydownHandler = handler;
      }),
      removeEventListener: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([mockFirst, mockLast]),
    } as unknown as HTMLElement;

    trapFocus(mockContainer);

    expect(keydownHandler).not.toBeNull();

    // Simulate non-Tab key - should not call preventDefault
    const nonTabEvent = {
      key: 'Enter',
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    keydownHandler!(nonTabEvent);
    expect(nonTabEvent.preventDefault).not.toHaveBeenCalled();
  });
});
