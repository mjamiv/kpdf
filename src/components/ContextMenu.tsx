import { useEffect, useRef, useCallback } from 'react';
import type { ContextMenuItem } from './contextMenuItems';

type ContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusItem = useCallback((index: number) => {
    const enabledItems = itemRefs.current.filter((el) => el && !el.disabled);
    const target = enabledItems[index];
    if (target) target.focus();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Auto-focus first item on open
  useEffect(() => {
    requestAnimationFrame(() => focusItem(0));
  }, [focusItem]);

  // Clamp to viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const el = ref.current;
    if (rect.right > window.innerWidth) el.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) el.style.top = `${y - rect.height}px`;
  }, [x, y]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const enabledItems = itemRefs.current.filter((el) => el && !el.disabled);
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentIndex < enabledItems.length - 1 ? currentIndex + 1 : 0;
        enabledItems[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : enabledItems.length - 1;
        enabledItems[prev]?.focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        enabledItems[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        enabledItems[enabledItems.length - 1]?.focus();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }} role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => { itemRefs.current[i] = el; }}
          className={`context-menu-item${item.danger ? ' danger' : ''}`}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => { item.action(); onClose(); }}
        >
          <span>{item.label}</span>
          {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
