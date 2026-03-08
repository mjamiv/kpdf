import { useEffect } from 'react';
import { TOOL_SHORTCUTS } from '../tools/shortcuts';

type ShortcutHelpPanelProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ShortcutHelpPanel({ visible, onClose }: ShortcutHelpPanelProps) {
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="shortcut-panel-overlay" onClick={onClose}>
      <div className="shortcut-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard Shortcuts</h3>
        <table>
          <thead>
            <tr><th>Key</th><th>Tool</th></tr>
          </thead>
          <tbody>
            {TOOL_SHORTCUTS.map((s) => (
              <tr key={s.key}><td><kbd>{s.key.toUpperCase()}</kbd></td><td>{s.label}</td></tr>
            ))}
            <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo</td></tr>
            <tr><td><kbd>Ctrl+Shift+Z</kbd></td><td>Redo</td></tr>
            <tr><td><kbd>Ctrl/Cmd +</kbd></td><td>Zoom in</td></tr>
            <tr><td><kbd>Ctrl/Cmd -</kbd></td><td>Zoom out</td></tr>
            <tr><td><kbd>Ctrl/Cmd 0</kbd></td><td>Reset zoom</td></tr>
            <tr><td><kbd>PageUp/PageDown</kbd></td><td>Prev/Next page</td></tr>
            <tr><td><kbd>Home/End</kbd></td><td>First/Last page</td></tr>
            <tr><td><kbd>H</kbd></td><td>Toggle pan mode</td></tr>
            <tr><td><kbd>Space (hold)</kbd></td><td>Temporary pan</td></tr>
            <tr><td><kbd>Delete</kbd></td><td>Delete selected</td></tr>
            <tr><td><kbd>[</kbd></td><td>Send backward</td></tr>
            <tr><td><kbd>]</kbd></td><td>Bring forward</td></tr>
            <tr><td><kbd>?</kbd></td><td>Toggle shortcuts</td></tr>
          </tbody>
        </table>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
