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
};

const HANDLE_SIZE = 8;

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

export default function SelectionHandles({
  selection,
  annotations,
  canvasWidth,
  canvasHeight,
  canvasRect,
  onHandleDown,
}: SelectionHandlesProps) {
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
      {/* Selection border */}
      <div style={{
        position: 'absolute',
        left: left - 1,
        top: top - 1,
        width: width + 2,
        height: height + 2,
        border: '1.5px dashed #3b82f6',
        pointerEvents: 'none',
      }} />

      {/* Resize handles */}
      {handles.map(({ anchor, x, y }) => (
        <div
          key={anchor}
          style={{
            position: 'absolute',
            left: x - HANDLE_SIZE / 2,
            top: y - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#ffffff',
            border: '1.5px solid #3b82f6',
            borderRadius: '2px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            cursor: anchorCursors[anchor],
            pointerEvents: 'auto',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandleDown(anchor, e);
          }}
        />
      ))}
    </div>
  );
}
