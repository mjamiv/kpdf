import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllStamps,
  addCustomStamp,
  removeCustomStamp,
  type StampDef,
  type StampCategory,
} from '../workflow/stamps';
import { preloadStampImage } from '../tools/stampTool';

type StampPickerProps = {
  visible: boolean;
  activeStampId: string;
  onSelectStamp: (stamp: StampDef) => void;
  onClose: () => void;
};

const CATEGORY_LABELS: Record<StampCategory, string> = {
  status: 'Status',
  aec: 'AEC',
  custom: 'Custom',
};

export default function StampPicker({ visible, activeStampId, onSelectStamp, onClose }: StampPickerProps) {
  const [stamps, setStamps] = useState<StampDef[]>(() => getAllStamps());
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newBorder, setNewBorder] = useState<'solid' | 'dashed'>('solid');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshStamps = useCallback(() => setStamps(getAllStamps()), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync localStorage stamps on open
    if (visible) refreshStamps();
  }, [visible, refreshStamps]);

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

  const grouped = useMemo(() => {
    const groups: Record<StampCategory, StampDef[]> = { status: [], aec: [], custom: [] };
    for (const s of stamps) {
      const cat = s.category ?? 'status';
      groups[cat].push(s);
    }
    return groups;
  }, [stamps]);

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    const id = `custom-${Date.now()}`;
    const stamp: StampDef = {
      id,
      label: newLabel.trim().toUpperCase(),
      color: newColor,
      defaultWidth: 0.08,
      defaultHeight: 0.04,
      category: 'custom',
      borderStyle: newBorder,
      imageUrl,
    };
    addCustomStamp(stamp);
    if (imageUrl) preloadStampImage(imageUrl);
    refreshStamps();
    setNewLabel('');
    setNewColor('#3b82f6');
    setNewBorder('solid');
    setImageUrl(undefined);
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    removeCustomStamp(id);
    refreshStamps();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  if (!visible) return null;

  return (
    <div className="stamp-picker" ref={panelRef} role="dialog" aria-label="Stamp picker">
      {(['status', 'aec', 'custom'] as StampCategory[]).map((cat) => {
        const items = grouped[cat];
        if (items.length === 0 && cat !== 'custom') return null;
        return (
          <div key={cat} className="stamp-picker-category">
            <div className="stamp-picker-category-header">{CATEGORY_LABELS[cat]}</div>
            <div className="stamp-picker-grid">
              {items.map((s) => (
                <button
                  key={s.id}
                  className={`stamp-picker-item${s.id === activeStampId ? ' active' : ''}`}
                  onClick={() => { onSelectStamp(s); onClose(); }}
                  title={s.label}
                >
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.label} className="stamp-picker-image" />
                  ) : (
                    <span
                      className="stamp-picker-preview"
                      style={{
                        borderColor: s.color,
                        color: s.color,
                        borderStyle: s.borderStyle ?? 'solid',
                      }}
                    >
                      {s.label}
                    </span>
                  )}
                  {cat === 'custom' && (
                    <button
                      className="stamp-picker-delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                      aria-label={`Delete ${s.label}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                      </svg>
                    </button>
                  )}
                </button>
              ))}
              {cat === 'custom' && items.length === 0 && (
                <span className="stamp-picker-empty">No custom stamps</span>
              )}
            </div>
          </div>
        );
      })}

      {!showCreate ? (
        <button className="stamp-picker-create-btn" onClick={() => setShowCreate(true)}>
          + Create Custom Stamp
        </button>
      ) : (
        <div className="stamp-picker-create">
          <input
            type="text"
            placeholder="Stamp label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <div className="stamp-picker-create-row">
            <label>
              Color
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
            </label>
            <label>
              Border
              <select value={newBorder} onChange={(e) => setNewBorder(e.target.value as 'solid' | 'dashed')}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </label>
          </div>
          <div className="stamp-picker-create-row">
            <button onClick={() => fileInputRef.current?.click()}>Upload Image</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            {imageUrl && <span className="stamp-picker-image-ok">Image loaded</span>}
          </div>
          <div className="stamp-picker-create-preview">
            {imageUrl ? (
              <img src={imageUrl} alt="Preview" className="stamp-picker-image" />
            ) : newLabel ? (
              <span
                className="stamp-picker-preview"
                style={{ borderColor: newColor, color: newColor, borderStyle: newBorder }}
              >
                {newLabel.toUpperCase()}
              </span>
            ) : (
              <span className="stamp-picker-preview-placeholder">Preview</span>
            )}
          </div>
          <div className="stamp-picker-create-actions">
            <button onClick={handleCreate} disabled={!newLabel.trim()}>Save</button>
            <button onClick={() => { setShowCreate(false); setImageUrl(undefined); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
