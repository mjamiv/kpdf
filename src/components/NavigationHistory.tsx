/**
 * NavigationHistory — Breadcrumb back/forward navigation for page visits.
 *
 * Integration with App.tsx:
 *   Props:
 *     - history: number[] — Array of visited page numbers (1-based), most recent at end.
 *     - currentIndex: number — Current position within the history array.
 *     - onBack: () => void — Navigate to previous page in history.
 *     - onForward: () => void — Navigate to next page in history.
 *     - onJump: (historyIndex: number) => void — Jump to a specific entry in history.
 *     - maxBreadcrumbs?: number — Maximum breadcrumb items to display (default 10).
 *
 *   How to wire:
 *     1. In App.tsx, maintain a navigation history state:
 *        const [navHistory, setNavHistory] = useState<number[]>([1]);
 *        const [navIndex, setNavIndex] = useState(0);
 *     2. On page change, push the new page onto history (truncating forward entries):
 *        const newHistory = [...navHistory.slice(0, navIndex + 1), newPage];
 *        setNavHistory(newHistory); setNavIndex(newHistory.length - 1);
 *     3. onBack: setNavIndex(i => i - 1) + navigate to navHistory[navIndex - 1]
 *     4. onForward: setNavIndex(i => i + 1) + navigate to navHistory[navIndex + 1]
 *     5. onJump: setNavIndex(idx) + navigate to navHistory[idx]
 */

import React from 'react';

type NavigationHistoryProps = {
  history: number[];
  currentIndex: number;
  onBack: () => void;
  onForward: () => void;
  onJump: (historyIndex: number) => void;
  maxBreadcrumbs?: number;
};

const NavigationHistory: React.FC<NavigationHistoryProps> = ({
  history,
  currentIndex,
  onBack,
  onForward,
  onJump,
  maxBreadcrumbs = 10,
}) => {
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  // Show the last N breadcrumbs centered around currentIndex
  const visibleStart = Math.max(0, Math.min(currentIndex - Math.floor(maxBreadcrumbs / 2), history.length - maxBreadcrumbs));
  const visibleEnd = Math.min(history.length, visibleStart + maxBreadcrumbs);
  const visibleHistory = history.slice(Math.max(0, visibleStart), visibleEnd);
  const startOffset = Math.max(0, visibleStart);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        fontFamily: 'sans-serif',
        fontSize: 12,
      }}
    >
      <button
        onClick={onBack}
        disabled={!canGoBack}
        title="Go back"
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 4,
          background: canGoBack ? '#fff' : '#f9fafb',
          cursor: canGoBack ? 'pointer' : 'default',
          padding: '2px 6px',
          color: canGoBack ? '#111827' : '#9ca3af',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        &#8592;
      </button>

      <button
        onClick={onForward}
        disabled={!canGoForward}
        title="Go forward"
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 4,
          background: canGoForward ? '#fff' : '#f9fafb',
          cursor: canGoForward ? 'pointer' : 'default',
          padding: '2px 6px',
          color: canGoForward ? '#111827' : '#9ca3af',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        &#8594;
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, flexWrap: 'wrap' }}>
        {startOffset > 0 && (
          <span style={{ color: '#9ca3af', fontSize: 11 }}>...</span>
        )}
        {visibleHistory.map((pageNum, i) => {
          const histIdx = startOffset + i;
          const isCurrent = histIdx === currentIndex;

          return (
            <React.Fragment key={`${histIdx}-${pageNum}`}>
              {i > 0 && <span style={{ color: '#d1d5db' }}>/</span>}
              <button
                onClick={() => onJump(histIdx)}
                style={{
                  border: 'none',
                  background: isCurrent ? '#2563eb' : 'transparent',
                  color: isCurrent ? '#fff' : '#6b7280',
                  borderRadius: 3,
                  padding: '1px 5px',
                  cursor: 'pointer',
                  fontWeight: isCurrent ? 600 : 400,
                  fontSize: 12,
                }}
                title={`Page ${pageNum}`}
              >
                {pageNum}
              </button>
            </React.Fragment>
          );
        })}
        {visibleEnd < history.length && (
          <span style={{ color: '#9ca3af', fontSize: 11 }}>...</span>
        )}
      </div>
    </div>
  );
};

export default NavigationHistory;
