/**
 * Accessibility utilities for screen reader support, focus management, and ARIA labels.
 *
 * Integration with App.tsx:
 * - announceToScreenReader(): Call after tool changes, annotation actions, page navigation.
 * - getAnnotationAriaLabel(): Used in SVG overlay elements for annotation aria-labels.
 * - getToolAriaLabel(): Used in toolbar buttons for tool descriptions.
 * - trapFocus(): Applied to modal panels (CommandPalette, etc.) when opened.
 * - generateKeyboardInstructions(): Display in status bar or help panel for current tool.
 *
 * The QA agent wires these into App.tsx and component props.
 */

import type { Annotation, Tool } from '../types';

// ---------- Screen Reader Announcements ----------

let liveRegion: HTMLElement | null = null;

/**
 * Creates or updates an aria-live region to announce messages to screen readers.
 * Uses assertive politeness for immediate announcements.
 */
export function announceToScreenReader(message: string): void {
  if (typeof document === 'undefined') return;

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(0, 0, 0, 0)';
    liveRegion.style.whiteSpace = 'nowrap';
    liveRegion.style.border = '0';
    liveRegion.style.padding = '0';
    liveRegion.id = 'kpdf-sr-announcer';
    document.body.appendChild(liveRegion);
  }

  // Clear then set to trigger announcement even if same message
  liveRegion.textContent = '';
  // Use setTimeout to ensure screen readers detect the change
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 50);
}

// ---------- Annotation ARIA Labels ----------

const ANNOTATION_TYPE_LABELS: Record<string, string> = {
  pen: 'Freehand drawing',
  rectangle: 'Rectangle',
  highlight: 'Highlight',
  text: 'Text note',
  arrow: 'Arrow',
  callout: 'Callout',
  cloud: 'Cloud markup',
  measurement: 'Measurement',
  polygon: 'Polygon',
  stamp: 'Stamp',
  ellipse: 'Ellipse',
  area: 'Area measurement',
  angle: 'Angle measurement',
  count: 'Count marker',
  dimension: 'Dimension line',
  polyline: 'Polyline',
};

export function getAnnotationAriaLabel(annotation: Annotation): string {
  const typeLabel = ANNOTATION_TYPE_LABELS[annotation.type] ?? annotation.type;
  const parts: string[] = [typeLabel];

  if (annotation.color) {
    parts.push(`color ${annotation.color}`);
  }

  if (annotation.author) {
    parts.push(`by ${annotation.author}`);
  }

  if (annotation.locked) {
    parts.push('locked');
  }

  if (annotation.status) {
    parts.push(`status ${annotation.status}`);
  }

  if ('text' in annotation && annotation.text) {
    const preview = annotation.text.length > 50
      ? annotation.text.substring(0, 50) + '...'
      : annotation.text;
    parts.push(`content: ${preview}`);
  }

  if ('label' in annotation && annotation.label) {
    parts.push(`label: ${annotation.label}`);
  }

  return parts.join(', ');
}

// ---------- Tool ARIA Labels ----------

const TOOL_DESCRIPTIONS: Record<Tool, string> = {
  select: 'Select and move annotations',
  pen: 'Draw freehand strokes',
  rectangle: 'Draw rectangles',
  highlight: 'Highlight areas',
  text: 'Add text notes',
  arrow: 'Draw arrows',
  callout: 'Add callout annotations with leader lines',
  cloud: 'Draw cloud markups',
  measurement: 'Measure distances',
  polygon: 'Draw polygons',
  stamp: 'Place stamps',
  area: 'Measure area',
  angle: 'Measure angles',
  count: 'Count items',
  dimension: 'Add dimension lines',
  ellipse: 'Draw ellipses',
  polyline: 'Draw polylines',
  hyperlink: 'Add hyperlinks between pages',
};

export function getToolAriaLabel(tool: Tool): string {
  return TOOL_DESCRIPTIONS[tool] ?? `${tool} tool`;
}

// ---------- Focus Trap ----------

/**
 * Creates a focus trap within a container element.
 * Returns a cleanup function to remove the trap.
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function getFocusableElements(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  // Focus the first focusable element
  const focusable = getFocusableElements();
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

// ---------- Keyboard Instructions ----------

const TOOL_INSTRUCTIONS: Record<Tool, string> = {
  select: 'Click to select an annotation. Shift+click to add to selection. Arrow keys to nudge. Delete to remove.',
  pen: 'Click and drag to draw. Release to finish stroke. Hold Shift to constrain to straight lines.',
  rectangle: 'Click and drag to create a rectangle. Hold Shift to constrain to a square.',
  highlight: 'Click and drag to highlight an area.',
  text: 'Click to place a text note. Type to enter text. Press Escape to finish.',
  arrow: 'Click to set start point, drag to end point. Hold Shift to constrain to 45-degree angles.',
  callout: 'Click to place the callout box, then drag the leader line to the target point.',
  cloud: 'Click and drag to create a cloud markup region.',
  measurement: 'Click to set start point, then click to set end point. The distance is displayed automatically.',
  polygon: 'Click to add vertices. Double-click or press Enter to close the polygon. Press Escape to cancel.',
  stamp: 'Click to place a stamp at the cursor position.',
  area: 'Click to add vertices defining the area. Double-click to close and calculate area.',
  angle: 'Click vertex, then two ray endpoints to measure the angle between them.',
  count: 'Click to place count markers. Each click increments the count.',
  dimension: 'Click start and end points to add a dimension line with measurement.',
  ellipse: 'Click and drag to create an ellipse. Hold Shift to constrain to a circle.',
  polyline: 'Click to add points. Double-click or press Enter to finish the polyline.',
  hyperlink: 'Click and drag to create a hyperlink region that navigates to another page.',
};

export function generateKeyboardInstructions(tool: Tool): string {
  return TOOL_INSTRUCTIONS[tool] ?? `Use the ${tool} tool to annotate the document.`;
}
