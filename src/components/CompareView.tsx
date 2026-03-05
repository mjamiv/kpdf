/**
 * CompareView — Side-by-side document comparison with sync scrolling, overlay, and diff navigation.
 *
 * Integration with App.tsx:
 *   Props:
 *     - leftCanvasRef: React.RefObject<HTMLCanvasElement> — Canvas rendering the "old" PDF page.
 *     - rightCanvasRef: React.RefObject<HTMLCanvasElement> — Canvas rendering the "new" PDF page.
 *     - diffResult: DiffResult | null — The computed pixel diff (from src/pdf/comparison.ts).
 *     - onRequestDiff: () => void — Callback to trigger diff computation.
 *     - onNavigateDiff: (regionIndex: number) => void — Callback when user clicks prev/next difference.
 *     - currentDiffIndex: number — Index of the currently focused diff region.
 *     - totalDiffRegions: number — Total number of diff regions.
 *
 *   How to wire:
 *     1. Render two PDF pages into separate canvases (left = old, right = new).
 *     2. Call computePixelDiff() from src/pdf/comparison.ts with the two canvas ImageData objects.
 *     3. Pass the DiffResult to this component.
 *     4. Implement onNavigateDiff to scroll/highlight the relevant region.
 *     5. Overlay mode draws the diff image data onto a third canvas.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

export type DiffRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiffResult = {
  diffPixelCount: number;
  diffPercentage: number;
  diffRegions: DiffRegion[];
  diffImageData: ImageData;
};

type CompareViewProps = {
  leftCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  rightCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  diffResult: DiffResult | null;
  onRequestDiff: () => void;
  onNavigateDiff: (regionIndex: number) => void;
  currentDiffIndex: number;
  totalDiffRegions: number;
};

type ViewMode = 'side-by-side' | 'overlay';

const CompareView: React.FC<CompareViewProps> = ({
  leftCanvasRef,
  rightCanvasRef,
  diffResult,
  onRequestDiff,
  onNavigateDiff,
  currentDiffIndex,
  totalDiffRegions,
}) => {
  const [mode, setMode] = useState<ViewMode>('side-by-side');
  const [opacity, setOpacity] = useState(0.5);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw overlay diff image
  useEffect(() => {
    if (mode !== 'overlay' || !diffResult || !overlayCanvasRef.current) return;
    const canvas = overlayCanvasRef.current;
    canvas.width = diffResult.diffImageData.width;
    canvas.height = diffResult.diffImageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(diffResult.diffImageData, 0, 0);
  }, [mode, diffResult]);

  const handlePrevDiff = useCallback(() => {
    if (currentDiffIndex > 0) {
      onNavigateDiff(currentDiffIndex - 1);
    }
  }, [currentDiffIndex, onNavigateDiff]);

  const handleNextDiff = useCallback(() => {
    if (currentDiffIndex < totalDiffRegions - 1) {
      onNavigateDiff(currentDiffIndex + 1);
    }
  }, [currentDiffIndex, totalDiffRegions, onNavigateDiff]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
          fontSize: 13,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setMode('side-by-side')}
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: mode === 'side-by-side' ? '#2563eb' : '#fff',
              color: mode === 'side-by-side' ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Side by Side
          </button>
          <button
            onClick={() => setMode('overlay')}
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: mode === 'overlay' ? '#2563eb' : '#fff',
              color: mode === 'overlay' ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Overlay
          </button>
        </div>

        {mode === 'overlay' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Opacity:
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              style={{ width: 100 }}
            />
            <span style={{ minWidth: 30 }}>{Math.round(opacity * 100)}%</span>
          </label>
        )}

        <button
          onClick={onRequestDiff}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Compute Diff
        </button>

        {diffResult && (
          <>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {diffResult.diffPercentage.toFixed(1)}% changed ({totalDiffRegions} region{totalDiffRegions !== 1 ? 's' : ''})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={handlePrevDiff}
                disabled={currentDiffIndex <= 0}
                style={{
                  padding: '2px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: currentDiffIndex > 0 ? 'pointer' : 'default',
                  fontSize: 12,
                  color: currentDiffIndex > 0 ? '#111827' : '#9ca3af',
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, lineHeight: '24px' }}>
                {totalDiffRegions > 0 ? `${currentDiffIndex + 1}/${totalDiffRegions}` : '-'}
              </span>
              <button
                onClick={handleNextDiff}
                disabled={currentDiffIndex >= totalDiffRegions - 1}
                style={{
                  padding: '2px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: currentDiffIndex < totalDiffRegions - 1 ? 'pointer' : 'default',
                  fontSize: 12,
                  color: currentDiffIndex < totalDiffRegions - 1 ? '#111827' : '#9ca3af',
                }}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'auto', position: 'relative' }}>
        {mode === 'side-by-side' ? (
          <>
            <div style={{ flex: 1, overflow: 'auto', borderRight: '1px solid #e5e7eb' }}>
              <div style={{ padding: '4px 8px', fontSize: 11, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                Original
              </div>
              <canvas ref={leftCanvasRef} style={{ display: 'block', maxWidth: '100%' }} />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ padding: '4px 8px', fontSize: 11, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                Revised
              </div>
              <canvas ref={rightCanvasRef} style={{ display: 'block', maxWidth: '100%' }} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
            <canvas ref={leftCanvasRef} style={{ display: 'block', maxWidth: '100%' }} />
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                opacity,
                pointerEvents: 'none',
                maxWidth: '100%',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareView;
