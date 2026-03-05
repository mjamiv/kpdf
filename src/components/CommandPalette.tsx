/**
 * Fuzzy-search command palette (Cmd+K / Ctrl+K).
 *
 * Integration with App.tsx:
 * - Add state: const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
 * - Add keyboard listener for Cmd+K / Ctrl+K to toggle commandPaletteOpen.
 * - Build commands using useCommandRegistry hook.
 * - Render:
 *     <CommandPalette
 *       commands={commands}
 *       isOpen={commandPaletteOpen}
 *       onClose={() => setCommandPaletteOpen(false)}
 *       onExecute={(id) => { ... }}
 *     />
 *
 * Features:
 * - Fuzzy text matching via fuzzyMatch utility
 * - Keyboard navigation (up/down/enter/escape)
 * - Category grouping and shortcut display
 * - Max 10 results shown
 * - Focus trap when open
 *
 * The QA agent handles wiring this into App.tsx.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { trapFocus } from '../utils/accessibility';
import type { CommandItem } from '../hooks/useCommandRegistry';

export type CommandPaletteProps = {
  commands: CommandItem[];
  isOpen: boolean;
  onClose: () => void;
  onExecute: (commandId: string) => void;
};

type ScoredCommand = CommandItem & { score: number; matchRanges: Array<[number, number]> };

const MAX_RESULTS = 10;

const CATEGORY_ORDER: Record<string, number> = {
  tool: 0,
  action: 1,
  navigation: 2,
  view: 3,
  export: 4,
};

const CATEGORY_LABELS: Record<string, string> = {
  tool: 'Tools',
  action: 'Actions',
  navigation: 'Navigation',
  view: 'View',
  export: 'Export',
};

function filterAndScore(commands: CommandItem[], query: string): ScoredCommand[] {
  if (query.length === 0) {
    return commands
      .filter((c) => c.enabled !== false)
      .slice(0, MAX_RESULTS)
      .map((c) => ({ ...c, score: 0, matchRanges: [] }));
  }

  const scored: ScoredCommand[] = [];

  for (const cmd of commands) {
    if (cmd.enabled === false) continue;

    const labelResult = fuzzyMatch(query, cmd.label);
    const descResult = cmd.description ? fuzzyMatch(query, cmd.description) : null;

    const bestMatch = descResult && descResult.match && descResult.score > labelResult.score
      ? descResult
      : labelResult;

    if (bestMatch.match) {
      scored.push({
        ...cmd,
        score: bestMatch.score,
        matchRanges: bestMatch === labelResult ? bestMatch.ranges : [],
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS);
}

function groupByCategory(commands: ScoredCommand[]): Array<{ category: string; label: string; items: ScoredCommand[] }> {
  const groups = new Map<string, ScoredCommand[]>();

  for (const cmd of commands) {
    const existing = groups.get(cmd.category);
    if (existing) {
      existing.push(cmd);
    } else {
      groups.set(cmd.category, [cmd]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
    .map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items,
    }));
}

function HighlightedText({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  if (ranges.length === 0) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const [start, end] of ranges) {
    if (start > lastEnd) {
      parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd, start)}</span>);
    }
    parts.push(
      <strong key={`h-${start}`} style={{ color: '#2563eb' }}>
        {text.slice(start, end)}
      </strong>,
    );
    lastEnd = end;
  }

  if (lastEnd < text.length) {
    parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}

export function CommandPalette({ commands, isOpen, onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = filterAndScore(commands, query);
  const groups = groupByCategory(results);

  // Flat list of results for keyboard navigation
  const flatResults = groups.flatMap((g) => g.items);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const cleanup = trapFocus(containerRef.current);
      return cleanup;
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeCommand = useCallback(
    (cmd: ScoredCommand) => {
      onExecute(cmd.id);
      cmd.action();
      onClose();
    },
    [onExecute, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            executeCommand(flatResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, selectedIndex, executeCommand, onClose],
  );

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: 560,
          backgroundColor: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 16,
              padding: '4px 0',
              backgroundColor: 'transparent',
            }}
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
          />
        </div>

        <div
          id="command-palette-results"
          role="listbox"
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {flatResults.length === 0 && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              No matching commands
            </div>
          )}

          {groups.map((group) => (
            <div key={group.category}>
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                  letterSpacing: '0.05em',
                }}
              >
                {group.label}
              </div>
              {group.items.map((cmd) => {
                const idx = globalIndex++;
                const isSelected = idx === selectedIndex;

                return (
                  <div
                    key={cmd.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                      fontSize: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        <HighlightedText text={cmd.label} ranges={cmd.matchRanges} />
                      </div>
                      {cmd.description && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd
                        style={{
                          padding: '2px 6px',
                          fontSize: 11,
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          color: '#6b7280',
                          marginLeft: 12,
                          flexShrink: 0,
                        }}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #e5e7eb',
            fontSize: 11,
            color: '#9ca3af',
            display: 'flex',
            gap: 12,
          }}
        >
          <span><kbd style={{ fontFamily: 'monospace' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>↵</kbd> execute</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
