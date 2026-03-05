import { useState } from 'react';
import type { Tool } from '../types';
import { TOOL_SHORTCUTS } from '../tools/shortcuts';
import { isToolAllowed, type ReviewState } from '../workflow/reviewMode';
import { getToolAriaLabel } from '../utils/accessibility';
import ToolIcon from './ToolIcon';

type ToolRailProps = {
  tool: Tool;
  lockedTool: Tool | null;
  reviewState: ReviewState;
  pdfLoaded: boolean;
  panMode: boolean;
  color: string;
  onToolClick: (tool: Tool) => void;
  onToolDoubleClick: (tool: Tool) => void;
  onTogglePan: () => void;
  onSetColor: (c: string) => void;
  onToggleShortcuts: () => void;
};

type ToolGroup = {
  id: string;
  label: string;
  tools: Tool[];
  colorClass: string;
};

const TOOL_GROUPS: ToolGroup[] = [
  { id: 'basic', label: 'Basic', tools: ['select', 'pen', 'rectangle', 'highlight', 'text', 'ellipse'], colorClass: 'rail-basic' },
  { id: 'shapes', label: 'Shapes', tools: ['arrow', 'callout', 'cloud', 'polygon', 'polyline'], colorClass: 'rail-shapes' },
  { id: 'aec', label: 'AEC', tools: ['measurement', 'area', 'angle', 'count', 'dimension'], colorClass: 'rail-aec' },
  { id: 'stamp', label: 'Stamp', tools: ['stamp', 'hyperlink'], colorClass: 'rail-stamp' },
];

const toolShortcut = (t: Tool) => TOOL_SHORTCUTS.find((s) => s.tool === t)?.key?.toUpperCase() ?? '';
const toolLabel = (t: Tool) => TOOL_SHORTCUTS.find((s) => s.tool === t)?.label ?? t;

export default function ToolRail(props: ToolRailProps) {
  const { tool, lockedTool, reviewState, pdfLoaded, panMode, color, onToolClick, onToolDoubleClick, onTogglePan, onSetColor, onToggleShortcuts } = props;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ shapes: true, aec: true, stamp: true });

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <nav className="tool-rail" role="toolbar" aria-label="Annotation tools" aria-orientation="vertical">
      {TOOL_GROUPS.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false;
        const isBasic = group.id === 'basic';
        const visibleTools = isBasic || !isCollapsed ? group.tools : [];
        const hasActiveTool = group.tools.includes(tool);

        return (
          <div key={group.id} className={`rail-group ${group.colorClass}`}>
            {!isBasic && (
              <button
                className={`rail-group-toggle${hasActiveTool && isCollapsed ? ' has-active' : ''}`}
                onClick={() => toggleGroup(group.id)}
                title={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}
                aria-expanded={!isCollapsed}
                aria-label={`${group.label} tools`}
              >
                <span className="rail-group-label">{group.label}</span>
                <svg className={`rail-chevron${isCollapsed ? '' : ' open'}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <polyline points="3,4 5,6 7,4" />
                </svg>
              </button>
            )}
            {visibleTools.map((id) => (
              <button
                key={id}
                className={`rail-btn${tool === id ? ' active' : ''}${lockedTool === id ? ' locked' : ''}`}
                onClick={(e) => { if (e.detail === 1) onToolClick(id); }}
                onDoubleClick={(e) => { e.preventDefault(); onToolDoubleClick(id); }}
                disabled={!pdfLoaded || !isToolAllowed(id, reviewState)}
                title={`${toolLabel(id)}${lockedTool === id ? ' (locked)' : ''} [${toolShortcut(id)}]`}
                aria-label={getToolAriaLabel(id)}
              >
                <ToolIcon tool={id} size={18} />
              </button>
            ))}
            {!isBasic && <div className="rail-group-divider" />}
          </div>
        );
      })}

      <div className="rail-spacer" />

      {/* Color picker */}
      <input
        className="rail-color"
        type="color"
        value={color}
        onChange={(e) => onSetColor(e.target.value)}
        disabled={!pdfLoaded}
        title="Markup color"
        aria-label="Markup color"
      />

      {/* Pan mode */}
      <button
        className={`rail-btn rail-bottom-btn${panMode ? ' active' : ''}`}
        onClick={onTogglePan}
        disabled={!pdfLoaded}
        title="Pan mode (H / hold Space)"
        aria-label="Pan mode"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2v14M2 9h14M5 5l4-3 4 3M5 13l4 3 4-3" />
        </svg>
      </button>

      {/* Shortcuts */}
      <button
        className="rail-btn rail-bottom-btn"
        onClick={onToggleShortcuts}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="9" cy="9" r="7" />
          <text x="9" y="12.5" fill="currentColor" fontSize="10" fontFamily="Outfit, sans-serif" textAnchor="middle" stroke="none" fontWeight="600">?</text>
        </svg>
      </button>
    </nav>
  );
}
