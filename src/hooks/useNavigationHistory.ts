import { useCallback, useRef, useState } from 'react';

export type NavHistoryState = {
  history: number[];
  currentIndex: number;
};

export function useNavigationHistory() {
  const [history, setHistory] = useState<number[]>([1]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const suppressPushRef = useRef(false);

  const pushPage = useCallback((page: number) => {
    if (suppressPushRef.current) {
      suppressPushRef.current = false;
      return;
    }
    setHistory((prev) => {
      setCurrentIndex((idx) => {
        const truncated = prev.slice(0, idx + 1);
        if (truncated[truncated.length - 1] === page) return idx;
        const next = [...truncated, page];
        // Defer setHistory update
        setTimeout(() => setHistory(next), 0);
        return next.length - 1;
      });
      return prev;
    });
  }, []);

  const goBack = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx <= 0) return idx;
      suppressPushRef.current = true;
      return idx - 1;
    });
  }, []);

  const goForward = useCallback(() => {
    setCurrentIndex((idx) => {
      setHistory((h) => {
        if (idx >= h.length - 1) return h;
        suppressPushRef.current = true;
        setCurrentIndex(idx + 1);
        return h;
      });
      return idx;
    });
  }, []);

  const jumpTo = useCallback((historyIndex: number) => {
    suppressPushRef.current = true;
    setCurrentIndex(historyIndex);
  }, []);

  const pageAtIndex = history[currentIndex] ?? 1;

  return {
    history,
    currentIndex,
    currentPage: pageAtIndex,
    pushPage,
    goBack,
    goForward,
    jumpTo,
  };
}
