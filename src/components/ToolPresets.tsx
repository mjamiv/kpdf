import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tool } from '../types';

export type ToolPreset = {
  id: string;
  name: string;
  color: string;
  tool: Tool;
};

type ToolPresetsProps = {
  visible: boolean;
  currentColor: string;
  currentTool: Tool;
  onApplyPreset: (preset: ToolPreset) => void;
  onClose: () => void;
};

const PRESETS_KEY = 'kpdf-tool-presets';

const DEFAULT_PRESETS: ToolPreset[] = [
  { id: 'preset-electrical', name: 'Electrical (Red)', color: '#dc2626', tool: 'pen' },
  { id: 'preset-structural', name: 'Structural (Blue)', color: '#2563eb', tool: 'pen' },
  { id: 'preset-plumbing', name: 'Plumbing (Green)', color: '#16a34a', tool: 'pen' },
  { id: 'preset-mechanical', name: 'Mechanical (Orange)', color: '#ea580c', tool: 'pen' },
  { id: 'preset-fire', name: 'Fire Protection (Magenta)', color: '#c026d3', tool: 'pen' },
];

function loadPresets(): ToolPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [...DEFAULT_PRESETS];
    return JSON.parse(raw) as ToolPreset[];
  } catch {
    return [...DEFAULT_PRESETS];
  }
}

function savePresets(presets: ToolPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

const TOOL_LABELS: Partial<Record<Tool, string>> = {
  pen: 'Pen', rectangle: 'Rect', highlight: 'Highlight', text: 'Text',
  arrow: 'Arrow', callout: 'Callout', cloud: 'Cloud', measurement: 'Measure',
  polygon: 'Polygon', stamp: 'Stamp', select: 'Select',
};

export default function ToolPresets({ visible, currentColor, currentTool, onApplyPreset, onClose }: ToolPresetsProps) {
  const [presets, setPresets] = useState<ToolPreset[]>(() => loadPresets());
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => setPresets(loadPresets()), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync localStorage presets on open
    if (visible) refresh();
  }, [visible, refresh]);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible, onClose]);

  const handleSave = () => {
    if (!newName.trim()) return;
    const preset: ToolPreset = {
      id: `preset-${Date.now()}`,
      name: newName.trim(),
      color: currentColor,
      tool: currentTool,
    };
    const updated = [...presets, preset];
    savePresets(updated);
    setPresets(updated);
    setNewName('');
    setShowSave(false);
  };

  const handleDelete = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    savePresets(updated);
    setPresets(updated);
  };

  if (!visible) return null;

  return (
    <div className="tool-presets" ref={panelRef} role="dialog" aria-label="Tool presets">
      <div className="tool-presets-header">
        <span>Tool Presets</span>
        <button onClick={onClose} aria-label="Close presets">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
      <div className="tool-presets-list">
        {presets.length === 0 && <span className="tool-presets-empty">No presets saved</span>}
        {presets.map((p) => (
          <div key={p.id} className="tool-preset-item" onClick={() => { onApplyPreset(p); onClose(); }}>
            <span className="tool-preset-swatch" style={{ background: p.color }} />
            <span className="tool-preset-name">{p.name}</span>
            <span className="tool-preset-tool">{TOOL_LABELS[p.tool] ?? p.tool}</span>
            <button
              className="tool-preset-delete"
              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
              aria-label={`Delete ${p.name}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {!showSave ? (
        <button className="tool-presets-save-btn" onClick={() => setShowSave(true)}>
          Save Current ({TOOL_LABELS[currentTool] ?? currentTool})
        </button>
      ) : (
        <div className="tool-presets-save-form">
          <input
            type="text"
            placeholder="Preset name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <button onClick={handleSave} disabled={!newName.trim()}>Save</button>
          <button onClick={() => setShowSave(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
