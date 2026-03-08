import { useState } from 'react';
import type { Annotation, AnchorPosition } from '../types';
import type { SelectionState } from '../engine/selection';
import { boundingBox } from '../engine/hitTest';

type SelectionHandlesProps = {
  selection: SelectionState;
  annotations: Annotation[];
  canvasWidth: number;
  canvasHeight: number;
  canvasRect: DOMRect | null;
  onHandleDown: (anchor: AnchorPosition, e: React.PointerEvent) => void;
  onKeyboardResize?: (anchor: AnchorPosition, dx: number, dy: number) => void;
};

const anchorCursors: Record<AnchorPosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

const anchorLabels: Record<AnchorPosition, string> = {
  nw: 'Resize top-left corner',
  n: 'Resize top edge',
  ne: 'Resize top-right corner',
  e: 'Resize right edge',
  se: 'Resize bottom-right corner',
  s: 'Resize bottom edge',
  sw: 'Resize bottom-left corner',
  w: 'Resize left edge',
};

export default function SelectionHandles({
  selection,
  annotations,
  canvasWidth,
  canvasHeight,
  canvasRect,
  onHandleDown,
  onKeyboardResize,
}: SelectionHandlesProps) {
  const [hoveredHandle, setHoveredHandle] = useState<AnchorPosition | null>(null);

  if (selection.ids.size === 0 || !canvasRect) return null;

  const selected = annotations.filter((a) => selection.ids.has(a.id));
  if (selected.length === 0) return null;

  // Compute union bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ann of selected) {
    const bb = boundingBox(ann);
    minX = Math.min(minX, bb.x);
    minY = Math.min(minY, bb.y);
    maxX = Math.max(maxX, bb.x + bb.width);
    maxY = Math.max(maxY, bb.y + bb.height);
  }

  // Convert to pixel positions relative to canvas
  const left = minX * canvasWidth;
  const top = minY * canvasHeight;
  const width = (maxX - minX) * canvasWidth;
  const height = (maxY - minY) * canvasHeight;

  const handles: { anchor: AnchorPosition; x: number; y: number }[] = [
    { anchor: 'nw', x: left, y: top },
    { anchor: 'n', x: left + width / 2, y: top },
    { anchor: 'ne', x: left + width, y: top },
    { anchor: 'e', x: left + width, y: top + height / 2 },
    { anchor: 'se', x: left + width, y: top + height },
    { anchor: 's', x: left + width / 2, y: top + height },
    { anchor: 'sw', x: left, y: top + height },
    { anchor: 'w', x: left, y: top + height / 2 },
  ];

  return (
    <div className="selection-handles" style={{ position: 'absolute', left: 0, top: 0, width: canvasWidth, height: canvasHeight, pointerEvents: 'none' }}>
      <div className="selection-handles-border" style={{ left: left - 1, top: top - 1, width: width + 2, height: height + 2 }} />
      {handles.map(({ anchor, x, y }) => (
        <div
          key={anchor}
          className="selection-handle"
          tabIndex={0}
          role="button"
          aria-label={anchorLabels[anchor]}
          style={{
            left: x,
            top: y,
            cursor: anchorCursors[anchor],
            ...(hoveredHandle === anchor ? {
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              borderColor: 'var(--kpdf-info)',
              boxShadow: '0 0 6px var(--accent-glow)',
              background: 'var(--kpdf-paper-elevated)',
            } : {}),
          }}
          onPointerEnter={() => setHoveredHandle(anchor)}
          onPointerLeave={() => setHoveredHandle(null)}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandleDown(anchor, e);
          }}
          onKeyDown={(e) => {
            if (!onKeyboardResize) return;
            const step = e.shiftKey ? 0.001 : 0.005;
            let dx = 0, dy = 0;
            switch (e.key) {
              case 'ArrowLeft': dx = -step; break;
              case 'ArrowRight': dx = step; break;
              case 'ArrowUp': dy = -step; break;
              case 'ArrowDown': dy = step; break;
              default: return;
            }
            e.preventDefault();
            onKeyboardResize(anchor, dx, dy);
          }}
        />
      ))}
    </div>
  );
}
